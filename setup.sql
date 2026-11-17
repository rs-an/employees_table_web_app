-- The database and application user are created by the MySQL Docker image.
-- With an existing MySQL installation, select the target database before importing.
CREATE TABLE IF NOT EXISTS employees (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(32) NOT NULL DEFAULT '',
    middle_name VARCHAR(32) NOT NULL DEFAULT '',
    surname VARCHAR(32) NOT NULL DEFAULT '',
    department VARCHAR(32) NOT NULL DEFAULT '',
    position VARCHAR(32) NOT NULL DEFAULT '',
    birthday VARCHAR(32) NOT NULL DEFAULT '',
    tel VARCHAR(32) NOT NULL DEFAULT '',
    email VARCHAR(32) NOT NULL DEFAULT ''
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
