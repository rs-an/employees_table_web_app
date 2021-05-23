const convertObj = ({ div, div_id, div_value, div_selected, text, node, size, type, id, name, value, children = [] }) => {
    if (div == undefined) {
        var bra = '';
        var c = '';
        var ket = '';
    }
    else {
        var bra = `<${div}`;
        var c = `>`;
        var ket = `</${div}>`;
    }
    if (div_value == undefined)
        div_value = '';
    else
        div_value = ` value="${div_value}"`;
    if (div_id == undefined)
        div_id = '';
    else
        div_id = ` id="${div_id}"`;
    if (div_selected == undefined)
        div_selected = '';
    else
        div_selected = ` selected="${div_selected}"`;
    if (text == undefined)
        text = '';
    if (node == undefined) {
        var no = '';
        var de = '';
    }
    else {
        var no = '<' + node;
        var de = '>';
    }
    if (type == undefined)
        type = '';
    else
        type = ` type="${type}"`;
    if (size == undefined)
        size = '';
    else
        size = ` size="${size}"`;
    if (id == undefined)
        id = '';
    else
        id = ` id="${id}"`;
    if (name == undefined)
        name = '';
    else
        name = ` name="${name}"`;
    if (value == undefined)
        value = '';
    else
        value = ` value="${value}"`;


    return `${bra}${div_id}${div_value}${div_selected}${c}${text}${no}${size}${type}${id}${name}${value}${de}${children.map(convertObj).join('')}${ket}`;
}

$(function () {
    var table = $('#example').DataTable({
        columnDefs: [{
            orderable: true,
            targets: [0, 1, 2, 3, 4],
        }]
    });
    const department_const = {
        children: [
            {
                div: "option",
                div_value: "empty",
                div_selected: undefined,
                text: '',
            },
            {
                div: "option",
                div_value: "HR",
                div_selected: undefined,
                text: 'HR',
            },
            {
                div: "option",
                div_value: "marketing",
                div_selected: undefined,
                text: 'marketing',
            },
            {
                div: "option",
                div_value: "development",
                div_selected: undefined,
                text: 'development',
            }
        ]
    }

    var webSocket = new WebSocket("ws://127.0.0.1:15000");

    webSocket.onmessage = function (event) {
        let data = JSON.parse(event.data);
        console.log(data);
        switch (data.type) {
            case "allEmployees":
                for (var employee of data.employees) {
                    let tree = {
                        div: "tr",
                        div_id: employee.id,
                        children: []
                    }
                    let department = JSON.parse(JSON.stringify(department_const));
                    _children = department.children.find(function (element, index, array) {
                        if (element.div_value == employee.department)
                            return element;
                        else
                            return false;
                    });

                    if (_children)
                        _children.div_selected = "true";
                    for (let child of department.children)
                    {
                        child.div_id = "row_" + employee.id + "_name_" + child.div_value;
                    }
                    tree.children.push({
                        div: "td",
                        id: "row_" + employee.id + "_name",
                        node: 'input',
                        type: "text",
                        name: "row_" + employee.id + "_name",
                        value: employee.name + " " + employee.middle_name + " " + employee.surname
                    })
                    tree.children.push({
                        div: "td",
                        id: "row_" + employee.id + "_department",
                        node: 'select',
                        type: "text",
                        name: "row_" + employee.id + "_department",
                        children: department.children
                    })
                    tree.children.push({
                        div: "td",
                        id: "row_" + employee.id + "_position",
                        node: 'input',
                        type: "text",
                        name: "row_" + employee.id + "_position",
                        value: employee.position
                    })
                    tree.children.push({
                        div: "td",
                        id: "row_" + employee.id + "_birthday",
                        node: 'input',
                        type: "text",
                        name: "row_" + employee.id + "_birthday",
                        value: employee.birthday
                    })
                    tree.children.push({
                        div: "td",
                        id: "row_" + employee.id + "_tel",
                        node: 'input',
                        type: "text",
                        name: "row_" + employee.id + "_tel",
                        value: employee.tel
                    })
                    tree.children.push({
                        div: "td",
                        id: "row_" + employee.id + "_email",
                        node: 'input',
                        type: "text",
                        name: "row_" + employee.id + "_email",
                        value: employee.email
                    })
                    table.row.add(
                        $(convertObj(tree))
                    ).draw();
                }
                console.log(data);
                break;
            case "removeRow":
                table.row('#' + data.id).remove().draw(false);
                break;
            case "addRow":
                let tree = {
                    div: "tr",
                    div_id: data.id,
                    children: []
                }
                let department = department_const;
                tree.children.push({
                    div: "td",
                    id: "row_" + data.id + "_name",
                    node: 'input',
                    type: "text",
                    name: "row_" + data.id + "_name",
                    value: " "
                })
                tree.children.push({
                    div: "td",
                    id: "row_" + data.id + "_department",
                    node: 'select',
                    type: "text",
                    name: "row_" + data.id + "_department",
                    children: department.children
                })
                tree.children.push({
                    div: "td",
                    id: "row_" + data.id + "_position",
                    node: 'input',
                    type: "text",
                    name: "row_" + data.id + "_position",
                    value: " "
                })
                tree.children.push({
                    div: "td",
                    id: "row_" + data.id + "_birthday",
                    node: 'input',
                    type: "text",
                    name: "row_" + data.id + "_birthday",
                    value: " "
                })
                tree.children.push({
                    div: "td",
                    id: "row_" + data.id + "_tel",
                    node: 'input',
                    type: "text",
                    name: "row_" + data.id + "_tel",
                    value: " "
                })
                tree.children.push({
                    div: "td",
                    id: "row_" + data.id + "_email",
                    node: 'input',
                    type: "text",
                    name: "row_" + data.id + "_email",
                    value: " "
                })
                table.row.add(
                    $(convertObj(tree))
                ).draw();
                break;
            case "replaceData":
                let _id = `#row_${data.id}_${data.destination}`;
                if (data.destination == "department")
                {
                    $(_id + ` option[selected=selected]`).prop('selected', false);
                    $(_id + ` option[value=${data.data}]`).prop('selected', true);
                }
                else
                {
                    $(_id).attr('value', data.data);
                }
                break;
            default:
                console.log("Получены данные ");
                break;
        }

    };

    $('#example').on('change', 'input, select', function () {
        let attr = $(this).attr('id').split('_');
        webSocket.send(JSON.stringify({ type: "replaceData", data: $(this).val(), id: attr[1], destination: attr[2] }));
    });

    //////////////////////////////////
    $('#example tbody').on('click', 'tr', function () {
        if ($(this).hasClass('selected')) {
            $(this).removeClass('selected');
        }
        else {
            table.$('tr.selected').removeClass('selected');
            $(this).addClass('selected');
        }
    });

    $('#button').on("click", function () {
        var id = table.row('.selected').id();
        webSocket.send(JSON.stringify({
            type: "removeRow",
            id: id
        }));
    });

    $('#addRow').on('click', function () {
        webSocket.send(JSON.stringify({
            type: "addRow"
        }));
    });
});

