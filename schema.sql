-- CouponShare Database Schema
CREATE DATABASE IF NOT EXISTS couponshare;
USE couponshare;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    points INT DEFAULT 0,
    is_admin BOOLEAN DEFAULT FALSE,
    is_banned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coupons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    code VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    discount_type VARCHAR(30) DEFAULT 'percent',
    discount_value DECIMAL(10,2),
    store VARCHAR(100),
    expiry_date DATE,
    submitted_by INT,
    status ENUM('pending','approved','rejected') DEFAULT 'pending',
    reject_reason VARCHAR(255),
    claim_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS claims (
    id INT AUTO_INCREMENT PRIMARY KEY,
    coupon_id INT NOT NULL,
    user_id INT NOT NULL,
    claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_claim (coupon_id, user_id),
    FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Default admin user (password: admin123)
INSERT INTO users (name, email, password_hash, is_admin, points)
VALUES
  ('Admin', 'admin@couponshare.com', '$2b$12$aVkDeTx3qYbu3ymrMrVyPuForuVQ/RuK4pL2iBOihERKmC0wIF8o2', TRUE, 0),
  ('Regular User', 'user@couponshare.com', '$2b$12$xT3FnFbYfxxtuZvz0MjYfel2ChBy.bVBRxnDRKJ3LrI1XXsGB/Fke', FALSE, 0)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  password_hash = VALUES(password_hash),
  is_admin = VALUES(is_admin),
  points = VALUES(points);
