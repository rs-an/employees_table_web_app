$(function () {
    const fields = ['surname', 'name', 'middle_name', 'department', 'position', 'birthday', 'tel', 'email'];
    const departments = { '': 'Без отдела', HR: 'HR', marketing: 'Маркетинг', development: 'Разработка' };
    const employees = new Map();
    const editor = document.querySelector('#editor');
    const form = document.querySelector('#employee-form');
    const deleteDialog = document.querySelector('#delete-dialog');
    let ready = false;
    let loaded = false;
    let socket;
    let retryTimer;
    let toastTimer;
    let original = null;
    let pending = null;

    function element(tag, className, text) {
        const node = document.createElement(tag);
        node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }
    function fullName(employee) {
        return [employee.surname, employee.name, employee.middle_name].filter(Boolean).join(' ') || `Сотрудник #${employee.id}`;
    }
    function icon(name) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'icon');
        svg.setAttribute('aria-hidden', 'true');
        const use = document.createElementNS(svg.namespaceURI, 'use');
        use.setAttribute('href', `#i-${name}`);
        svg.append(use);
        return svg;
    }
    function controls() {
        $('#addRow').prop('disabled', !ready || Boolean(pending));
        $('#save-employee, #delete-employee, #confirm-delete').prop('disabled', !ready || Boolean(pending));
        $('#employee-form fieldset').prop('disabled', Boolean(pending));
        $('#close-editor, #cancel-editor, #cancel-delete').prop('disabled', Boolean(pending));
        $('#save-employee').text(pending?.type === 'save' ? 'Сохраняем…' : original ? 'Сохранить изменения' : 'Добавить');
        $('#confirm-delete').text(pending?.type === 'delete' ? 'Удаляем…' : 'Удалить');
        $('#empty-action').prop('disabled', !loaded || (!employees.size && !ready));
    }
    function showError(text) {
        const target = document.querySelector(editor.open ? '#form-error' : '#message');
        target.textContent = text;
        target.hidden = !text;
    }
    function clearErrors() {
        for (const target of document.querySelectorAll('#form-error, #message')) {
            target.hidden = true;
            target.textContent = '';
        }
    }
    function toast(text) {
        clearTimeout(toastTimer);
        $('#toast span').text(text);
        $('#toast').prop('hidden', false);
        toastTimer = setTimeout(() => $('#toast').prop('hidden', true), 3500);
    }
    function emptyState(api) {
        const count = api.rows({ search: 'applied' }).count();
        const empty = count === 0;
        $('#empty-state').prop('hidden', !empty);
        if (!loaded) {
            $('#empty-title').text('Загрузка…');
            $('#empty-copy').text('Ожидание подключения к серверу.');
        } else if (employees.size === 0) {
            $('#empty-title').text('Сотрудников пока нет');
            $('#empty-copy').text('Добавьте сотрудника, чтобы начать работу.');
        } else {
            $('#empty-title').text('Ничего не найдено');
            $('#empty-copy').text('Измените запрос или сбросьте фильтр.');
        }
        $('#empty-action').text(employees.size ? 'Сбросить фильтры' : 'Добавить сотрудника');
    }
    const table = $('#example').DataTable({
        data: [],
        rowId: row => `employee-${row.id}`,
        autoWidth: false,
        pageLength: 8,
        layout: { topStart: null, topEnd: null, bottomStart: 'info', bottomEnd: 'paging' },
        pagingType: 'simple_numbers',
        columns: [
            { data: null, title: 'Сотрудник', render(value, type, employee) {
                const name = fullName(employee);
                if (type !== 'display') return name;
                return element('span', 'person-name', name);
            } },
            { data: 'department', title: 'Отдел', render(value, type) {
                if (type !== 'display') return value || '';
                const known = Object.hasOwn(departments, value || '');
                return element('span', 'department-name', known ? departments[value || ''] : value);
            } },
            { data: 'position', title: 'Должность', render(value, type) {
                return type === 'display' ? element('span', value ? 'role-text' : 'missing', value || 'Не указана') : value || '';
            } },
            { data: null, title: 'Контакты', render(value, type, employee) {
                if (type !== 'display') return [employee.email, employee.tel].filter(Boolean).join(' ');
                const contacts = element('div', 'contacts');
                for (const contact of [employee.email, employee.tel].filter(Boolean)) contacts.append(element('span', '', contact));
                if (!contacts.children.length) contacts.append(element('span', 'missing', 'Не указаны'));
                return contacts;
            } },
            { data: 'birthday', title: 'Дата рождения', render(value, type) {
                if (type !== 'display') return value || '';
                const formatted = /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.split('-').reverse().join('-') : value;
                return element('span', value ? 'birthday' : 'missing', formatted || 'Не указана');
            } },
            { data: null, title: '', orderable: false, searchable: false, render(value, type, employee) {
                if (type !== 'display') return '';
                const button = element('button', 'icon-button edit-person');
                button.type = 'button';
                button.dataset.id = employee.id;
                button.setAttribute('aria-label', `Редактировать: ${fullName(employee)}`);
                button.append(icon('edit'));
                return button;
            } },
        ],
        language: {
            info: 'Показаны _START_–_END_ из _TOTAL_', infoEmpty: 'Нет сотрудников',
            infoFiltered: ' · всего _MAX_', emptyTable: '', zeroRecords: '',
            paginate: { first: 'В начало', last: 'В конец', next: 'Далее →', previous: '← Назад' },
            aria: { orderable: ': сортировать по столбцу', orderableReverse: ': изменить порядок', orderableRemove: ': убрать сортировку', paginate: { next: 'Следующая страница', previous: 'Предыдущая страница', first: 'Первая страница', last: 'Последняя страница', number: 'Страница ' } },
        },
        drawCallback() { emptyState(this.api()); },
    });
    function redraw() {
        table.clear().rows.add([...employees.values()]).draw(false);
        const info = table.page.info();
        if (info.pages && info.page >= info.pages) table.page(info.pages - 1).draw('page');
        controls();
    }
    function openEditor(employee = null) {
        if (pending) return;
        clearErrors();
        original = employee ? { ...employee } : null;
        form.reset();
        const departmentInput = form.elements.namedItem('department');
        departmentInput.querySelector('[data-legacy]')?.remove();
        if (employee?.department && !Object.hasOwn(departments, employee.department)) {
            const option = new Option(employee.department, employee.department);
            option.dataset.legacy = 'true';
            departmentInput.add(option);
        }
        for (const field of fields) form.elements.namedItem(field).value = employee?.[field] || '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(employee?.birthday || '')) {
            form.elements.namedItem('birthday').value = employee.birthday.split('-').reverse().join('-');
        }
        $('#editor-title').text(employee ? 'Карточка сотрудника' : 'Новый сотрудник');
        $('#delete-employee').prop('hidden', !employee);
        controls();
        editor.showModal();
        form.elements.namedItem('surname').focus();
    }
    function closeEditor() {
        if (!pending) editor.close();
    }
    function transmit(event, type) {
        if (!ready || socket.readyState !== WebSocket.OPEN) {
            showError('Нет соединения с сервером. Дождитесь подключения и повторите сохранение.');
            return;
        }
        clearErrors();
        const requestId = crypto.randomUUID();
        pending = { requestId, type };
        controls();
        socket.send(JSON.stringify({ ...event, requestId }));
    }
    function acknowledge(data) {
        if (!pending || data.requestId !== pending.requestId) return;
        const type = pending.type;
        pending = null;
        deleteDialog.close();
        editor.close();
        toast(type === 'delete' ? 'Сотрудник удалён' : data.type === 'addRow' ? 'Сотрудник добавлен' : 'Изменения сохранены');
    }
    function connection(state, label) {
        document.querySelector('#connection').dataset.state = state;
        $('#status').text(label);
    }
    function connect() {
        clearTimeout(retryTimer);
        ready = false;
        controls();
        connection('connecting', 'Подключение');
        socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`);
        socket.onmessage = event => {
            const data = JSON.parse(event.data);
            if (data.type === 'allEmployees') {
                ready = true;
                loaded = true;
                employees.clear();
                for (const employee of data.employees) employees.set(employee.id, employee);
                connection('ready', '');
                if (editor.open && original && !employees.has(original.id)) {
                    editor.close();
                    showError('Эта карточка уже удалена в другой вкладке.');
                }
            } else if (data.type === 'addRow') {
                employees.set(data.employee.id, data.employee);
                if (pending?.requestId === data.requestId) resetFilters();
                acknowledge(data);
            } else if (data.type === 'removeRow') {
                employees.delete(data.id);
                const own = pending?.requestId === data.requestId;
                acknowledge(data);
                if (!own && editor.open && original?.id === data.id) {
                    pending = null;
                    deleteDialog.close();
                    editor.close();
                    showError('Эта карточка удалена в другой вкладке.');
                }
            } else if (data.type === 'updateEmployee' || data.type === 'replaceData') {
                const employee = employees.get(data.id);
                if (employee) Object.assign(employee, data.type === 'updateEmployee' ? data.changes : { [data.destination]: data.data });
                acknowledge(data);
            } else if (data.type === 'error') {
                pending = null;
                deleteDialog.close();
                showError(data.message);
                socket.close();
            }
            redraw();
        };
        socket.onclose = () => {
            ready = false;
            if (pending) {
                pending = null;
                deleteDialog.close();
                showError('Соединение прервано. После подключения проверьте карточку: подтверждение сохранения не получено.');
            }
            controls();
            connection('offline', 'Нет соединения · переподключение');
            retryTimer = setTimeout(connect, 2000);
        };
        socket.onerror = () => connection('offline', 'Сервер недоступен');
    }
    function resetFilters() {
        $('#search, #department-filter').val('');
        table.search('').column(1).search('').draw();
    }
    $('#search').on('input', function () { table.search(this.value).draw(); });
    $('#department-filter').on('change', function () {
        table.column(1).search(this.value, { exact: true }).draw();
    });
    $('#addRow').on('click', () => openEditor());
    $('#empty-action').on('click', () => employees.size ? resetFilters() : openEditor());
    $('#example tbody').on('click', 'tr', function () {
        const employee = table.row(this).data();
        if (employee) openEditor(employee);
    });
    $('#close-editor, #cancel-editor').on('click', closeEditor);
    editor.addEventListener('cancel', event => { if (pending) event.preventDefault(); });
    deleteDialog.addEventListener('cancel', event => { if (pending) event.preventDefault(); });
    form.addEventListener('submit', event => {
        event.preventDefault();
        if (pending) return;
        const employee = Object.fromEntries(fields.map(field => [field, form.elements.namedItem(field).value.trim()]));
        if (employee.birthday) {
            const isoDate = employee.birthday.split('-').reverse().join('-');
            const date = new Date(`${isoDate}T00:00:00Z`);
            if (!/^\d{2}-\d{2}-\d{4}$/.test(employee.birthday) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== isoDate) {
                showError('Введите существующую дату в формате ДД-ММ-ГГГГ, например 25-12-1995.');
                form.elements.namedItem('birthday').focus();
                return;
            }
            employee.birthday = isoDate;
        }
        if (!employee.name && !employee.surname) {
            showError('Укажите имя или фамилию сотрудника.');
            form.elements.namedItem('surname').focus();
            return;
        }
        if (original) {
            const changes = Object.fromEntries(fields.filter(field => employee[field] !== (original[field] || '')).map(field => [field, employee[field]]));
            if (!Object.keys(changes).length) { editor.close(); return; }
            transmit({ type: 'updateEmployee', id: original.id, changes }, 'save');
        } else {
            transmit({ type: 'addRow', employee }, 'save');
        }
    });
    $('#delete-employee').on('click', () => {
        if (!original || pending) return;
        $('#delete-description').text(fullName(original));
        deleteDialog.showModal();
        document.querySelector('#cancel-delete').focus();
    });
    $('#cancel-delete').on('click', () => { if (!pending) deleteDialog.close(); });
    $('#confirm-delete').on('click', () => {
        if (original && !pending) transmit({ type: 'removeRow', id: original.id }, 'delete');
    });
    document.addEventListener('keydown', event => {
        if (event.key === '/' && !editor.open && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) {
            event.preventDefault();
            document.querySelector('#search').focus();
        }
    });
    connect();
});
