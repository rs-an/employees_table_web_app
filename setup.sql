
CREATE DATABASE employeeDB;

CREATE USER 'user'@'localhost' IDENTIFIED BY 'user';
GRANT ALL PRIVILEGES ON employeeDB.* TO 'user'@'localhost';
-- FLUSH PRIVILEGES;

-- SHOW GRANTS FOR 'user'@'localhost';

USE employeeDB;

CREATE TABLE employees (id int AUTO_INCREMENT, name varchar(32), middle_name varchar(32), surname varchar(32), department varchar(32), position varchar(32), birthday varchar(32),tel varchar(32),email varchar(32), PRIMARY KEY (id)) DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;
