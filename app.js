// const http = require("http");
const readline = require('readline');
const mysql = require("mysql2");
const express = require("express");
var bodyParser = require("body-parser");
const WebSocket = require('ws');

const urlencodedParser = bodyParser.urlencoded({ extended: false });

class employeeTable {
    rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    connection = mysql.createConnection({
        host: "localhost",
        user: "angelina",
        database: "employeeDB",
        password: "12345test"
    }).promise();

    app = express();
    wss = new WebSocket.Server({ port: 15000 });
    constructor() {
        var wss = this.wss;
        var connection = this.connection;
        this.wss.broadcast = function broadcast(msg) {
            wss.clients.forEach(function each(client) {
                client.send(msg);
             });
         };
        this.wss.on('connection', function (ws, req) {
            var all_employee =
            {
                type: "allEmployees",
                employees: []
            }
            connection.query("SELECT * FROM employees")
                .then(([rows, fields]) => {
                    for (let i in rows) {
                        all_employee.employees.push(rows[i]);
                    }
                    ws.send(JSON.stringify(all_employee));
                })
                .catch((err) => {
                    console.log(err);
                });

            // ws.send(JSON.stringify(all_employee));
            ws.on('message', function (message) {

                var event = JSON.parse(message);
                switch (event.type) {
                    case 'removeRow':
                        connection.query("DELETE FROM `employees` WHERE id = ?;", [Number(event.id)])
                            .then(([rows, fields]) => {
                                // console.log(rows); //?
                                wss.broadcast(JSON.stringify({ type: 'removeRow', id: event.id }))
                            })
                            .catch((err) => {
                                console.log(err);  //?
                            });
                        break;
                    case 'addRow':
                        connection.query("INSERT INTO `employees` " +
                            "(name, middle_name, surname, department, position, birthday, tel, email) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?);", ["", "", "", "", "", "", "", ""])
                            .then(([rows, fields]) => {
                                console.log(rows); //?
                                wss.broadcast(JSON.stringify({ type: 'addRow', id: rows.insertId }))
                            })
                            .catch((err) => {
                                console.log(err);  //?
                            });
                        break;
                    case 'replaceData':
                        connection.query("UPDATE `employees` SET " + event.destination + " = ? WHERE id = ?;", [event.data, Number(event.id)])
                            .then(([rows, fields]) => {
                                // console.log(rows); //?
                                // run();
                                wss.broadcast(JSON.stringify({ type: 'replaceData', id: event.id, destination: event.destination, data: event.data}))
                            })
                            .catch((err) => {
                                console.log(err['sqlMessage']);  //?
                                // run();
                            });
                        break;
                }
                console.log(event);

            });
        });
        this.connection.connect().catch((err) =>{
            console.log(err);
        });

        this.app.set("view engine", "ejs");
        this.app.use("/public", express.static("public"));



        this.app.post('/command', urlencodedParser, function (req, res) {
            if (!req.body) return res.sendStatus(400);
            let obj = JSON.parse(JSON.stringify(req.body));
            console.log("req.body")
            let Sa, Sl, message;
            switch (obj.comand) {
                case 'start':
                    console.log(message);
                    break;

            }
        });
        this.app.use("/", (request, response) => {
            var all_employee = [];
            connection.query("SELECT * FROM employees")
                .then(([rows, fields]) => {
                    for (let i in rows) {
                        all_employee.push(rows[i]);
                    }
                    response.render("index", {
                        employee: all_employee
                    });
                })
                .catch((err) => {
                    console.log(err);
                });
        });
        // this.app.use("/test", function(request, response){

        //     response.send("Главная страница");
        // });
        this.app.listen(3000);

    }
    commandReceive(receive) {
        switch (receive) {
            case 1:
                this.add_user();
                break;
            case 2:
                this.edit_user();
                break;
            case 3:
                this.delete_user();
                break;
            case 4:
                this.show_all_users();
                break;
        }
    }

    run() {
        var run = this.run.bind(this);
        this.rl.question("1 - Добавить сотрудника\n" +
            "2 - Редактировать сотрудника\n" +
            "3 - Удалить сотрудника\n" +
            "4 - Посмотреть список всех сотрудников\n",
            (receive) => {
                switch (receive) {
                    case "1":
                        this.add_user();
                        break;
                    case "2":
                        this.edit_user();
                        break;
                    case "3":
                        this.delete_user();
                        break;
                    case "4":
                        this.show_all_users();
                        break;
                    default:
                        console.log("Oh shit, im sorry");
                        run();
                }
            });
    }

    add_user() {
        var run = this.run.bind(this);
        this.rl.question('Введите имя: ', (name) => {
            this.rl.question('Введите отчество: ', (middle_name) => {
                this.rl.question('Введите фамилию: ', (surname) => {
                    this.rl.question('Введите название отдела: ', (department) => {
                        this.rl.question('Введите должность: ', (position) => {
                            this.rl.question('Введите дату рождения: ', (birthday) => {
                                this.rl.question('Введите номер телефона: ', (tel) => {
                                    this.rl.question('Введите эл. адрес: ', (email) => {
                                        this.connection.query("INSERT INTO `employees` " +
                                            "(name, middle_name, surname, department, position, birthday, tel, email) " +
                                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?);", [name, middle_name, surname, department, position, birthday, tel, email])
                                            .then(([rows, fields]) => {
                                                // console.log(rows); //?
                                                run();
                                            })
                                            .catch((err) => {
                                                console.log(err);  //?
                                            });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    }

    show_all_users() {
        var run = this.run.bind(this);
        this.connection.query("SELECT * FROM employees")
            .then(([rows, fields]) => {
                console.log(rows);
                run();
            })
            .catch((err) => {
                console.log(err);
            });
    }

    edit_user() {
        var run = this.run.bind(this);
        this.rl.question('Введите id сотрудника, которого нужно отредактировать: ', (input_id) => {
            this.rl.question('Какое поле хотите отредактировать: name, middle_name, ' +
                'surname, department, position, birthday, tel, email? ', (input_field) => {
                    this.rl.question('Введите новое значение для поля ' + input_field + ': ', (input_new_value) => {
                        // console.log("UPDATE employees SET ? = ? WHERE 'id' = ?;", [input_field, input_new_value, Number(input_id)]);
                        this.connection.query("UPDATE `employees` SET " + input_field + " = ? WHERE id = ?;", [input_new_value, Number(input_id)])
                            .then(([rows, fields]) => {
                                // console.log(rows); //?
                                run();
                            })
                            .catch((err) => {
                                console.log(err['sqlMessage']);  //?
                                run();
                            });
                    });
                });
        });
    }

    delete_user() {
        var run = this.run.bind(this);
        this.rl.question('Введите id сотрудника, которого нужно удалить: ', (input_id) => {
            this.connection.query("DELETE FROM `employees` WHERE id = ?;", [Number(input_id)])
                .then(([rows, fields]) => {
                    // console.log(rows); //?
                    run();
                })
                .catch((err) => {
                    console.log(err);  //?
                });
        });
    }
}

let some = new employeeTable();

// some.run();