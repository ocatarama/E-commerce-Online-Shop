CREATE TABLE produse (
    product_id NUMERIC PRIMARY KEY,
    product_name TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    price NUMERIC NOT NULL,
    manufacturer TEXT NOT NULL,
    product_code TEXT UNIQUE
);