$(function () {
    const fields = [
        ['surname', 'Фамилия'], ['name', 'Имя'], ['middle_name', 'Отчество'],
        ['department', 'Отдел'], ['position', 'Должность'], ['birthday', 'Дата рождения'],
        ['tel', 'Телефон'], ['email', 'Email'],
    ];
    const departments = { '': 'Не выбран', HR: 'HR', marketing: 'Маркетинг', development: 'Разработка' };
    const status = document.querySelector('#status');
    const message = document.querySelector('#message');
    let ready = false;
    let selectedId = null;
    let socket;
    let retryTimer;
    function controls() {
        $('#addRow').prop('disabled', !ready);
        $('#button').prop('disabled', !ready || selectedId === null);
        $('#example input, #example select').prop('disabled', !ready);
    }
    const table = $('#example').DataTable({
        data: [],
        rowId: row => `employee-${row.id}`,
        columns: fields.map(([field, title]) => ({
            data: field,
            title,
            defaultContent: '',
            render(value, type, row) {
                value = value || '';
                if (type !== 'display') return value;
                const input = document.createElement(field === 'department' ? 'select' : 'input');
                if (field === 'department') {
                    for (const [key, label] of Object.entries(departments)) input.add(new Option(label, key));
                    if (!(value in departments)) input.add(new Option(value, value));
                } else {
                    input.type = field === 'email' ? 'email' : field === 'tel' ? 'tel' : 'text';
                    input.maxLength = 32;
                    if (field === 'birthday') input.placeholder = 'ГГГГ-ММ-ДД';
                }
                input.value = value;
                input.dataset.id = row.id;
                input.dataset.field = field;
                input.setAttribute('aria-label', `${title}, сотрудник ${row.id}`);
                input.disabled = !ready;
                return input;
            },
        })),
        language: {
            search: 'Поиск:', lengthMenu: 'Показывать _MENU_',
            info: '_START_–_END_ из _TOTAL_ сотрудников', infoEmpty: 'Нет сотрудников',
            infoFiltered: '(всего _MAX_)', emptyTable: 'Добавьте первого сотрудника',
            zeroRecords: 'Ничего не найдено', paginate: { first: 'Первая', last: 'Последняя', next: 'Далее', previous: 'Назад' },
        },
        drawCallback() {
            $('#example tbody tr').removeClass('selected');
            if (selectedId !== null) $(`#employee-${selectedId}`).addClass('selected');
            controls();
        },
    });
    function showError(text) { message.textContent = text; }
    function send(event) {
        if (!ready || socket.readyState !== WebSocket.OPEN) {
            showError('Нет соединения с сервером. Изменение не сохранено.');
            return;
        }
        message.textContent = '';
        socket.send(JSON.stringify(event));
    }
    function connect() {
        clearTimeout(retryTimer);
        ready = false;
        controls();
        status.textContent = 'Подключение…';
        socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`);
        socket.onmessage = event => {
            const data = JSON.parse(event.data);
            if (data.type === 'allEmployees') {
                ready = true;
                selectedId = null;
                table.clear().rows.add(data.employees).draw();
                status.textContent = 'Подключено · изменения сохраняются автоматически';
            } else if (data.type === 'addRow') {
                table.row.add(data.employee).draw(false);
            } else if (data.type === 'removeRow') {
                table.row(`#employee-${data.id}`).remove().draw(false);
                if (selectedId === data.id) selectedId = null;
            } else if (data.type === 'replaceData') {
                const row = table.row(`#employee-${data.id}`);
                if (row.any()) {
                    const employee = row.data();
                    employee[data.destination] = data.data;
                    // Update the input and DataTables cache without replacing other active inputs.
                    const column = fields.findIndex(([field]) => field === data.destination);
                    table.cell(row.index(), column).data(data.data);
                }
            } else if (data.type === 'error') {
                showError(data.message);
                // Reload authoritative data; never leave an unsaved edit looking successful.
                socket.close();
            }
            controls();
        };
        socket.onclose = () => {
            ready = false;
            controls();
            status.textContent = 'Соединение потеряно. Повторное подключение…';
            retryTimer = setTimeout(connect, 2000);
        };
        socket.onerror = () => { status.textContent = 'Сервер недоступен'; };
    }
    $('#example').on('change', 'input, select', function () {
        const id = Number(this.dataset.id);
        const field = this.dataset.field;
        if (!this.checkValidity()) {
            this.reportValidity();
            this.value = table.row(`#employee-${id}`).data()[field] || '';
            return;
        }
        send({ type: 'replaceData', id, destination: field, data: this.value });
    });
    $('#example tbody').on('click', 'tr', function () {
        const row = table.row(this).data();
        if (!row) return;
        selectedId = row.id;
        $('#example tbody tr').removeClass('selected');
        $(this).addClass('selected');
        controls();
    });
    $('#button').on('click', () => {
        if (selectedId !== null && window.confirm('Удалить выбранного сотрудника?')) send({ type: 'removeRow', id: selectedId });
    });
    $('#addRow').on('click', () => {
        table.search('').order([[0, 'asc']]).draw();
        send({ type: 'addRow' });
    });
    connect();
});
