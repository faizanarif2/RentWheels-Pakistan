CREATE TABLE IF NOT EXISTS cars (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Economy','Sedan','SUV','Luxury')),
  city TEXT NOT NULL,
  daily_rate NUMERIC(12,2) NOT NULL CHECK (daily_rate >= 0),
  seats INTEGER NOT NULL CHECK (seats > 0),
  transmission TEXT NOT NULL,
  fuel_type TEXT NOT NULL,
  description TEXT NOT NULL,
  image_path TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY,
  booking_reference TEXT UNIQUE NOT NULL,
  car_id INTEGER NOT NULL REFERENCES cars(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  pickup_city TEXT NOT NULL,
  pickup_date DATE NOT NULL,
  return_date DATE NOT NULL,
  total_days INTEGER NOT NULL CHECK (total_days > 0),
  total_price NUMERIC(12,2) NOT NULL CHECK (total_price >= 0),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending','confirmed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (return_date > pickup_date)
);
CREATE INDEX IF NOT EXISTS idx_cars_city ON cars(city);
CREATE INDEX IF NOT EXISTS idx_cars_category ON cars(category);
CREATE INDEX IF NOT EXISTS idx_bookings_car_dates ON bookings(car_id, pickup_date, return_date);
CREATE INDEX IF NOT EXISTS idx_bookings_reference ON bookings(booking_reference);
INSERT INTO cars (slug,brand,model,category,city,daily_rate,seats,transmission,fuel_type,description,image_path) VALUES
('suzuki-alto-lahore','Suzuki','Alto','Economy','Lahore',6500,4,'Manual','Petrol','A compact city car that is easy to park and comfortable for everyday trips.','/cars/alto.jpg'),
('toyota-yaris-islamabad','Toyota','Yaris','Sedan','Islamabad',10500,5,'Automatic','Petrol','A refined sedan suited to city drives and longer motorway journeys.','/cars/yaris.jpg'),
('toyota-corolla-karachi','Toyota','Corolla','Sedan','Karachi',12500,5,'Automatic','Petrol','A practical, spacious sedan for family travel and business visits.','/cars/corolla.jpg'),
('honda-civic-faisalabad','Honda','Civic','Luxury','Faisalabad',18000,5,'Automatic','Petrol','A modern, comfortable drive with a premium cabin feel.','/cars/civic.jpg'),
('hyundai-elantra-multan','Hyundai','Elantra','Sedan','Multan',14500,5,'Automatic','Petrol','A roomy sedan with a smooth ride for trips around South Punjab.','/cars/elantra.jpg'),
('kia-sportage-peshawar','Kia','Sportage','SUV','Peshawar',22000,5,'Automatic','Petrol','A versatile SUV with generous cabin space for family outings.','/cars/sportage.jpg'),
('hyundai-tucson-lahore','Hyundai','Tucson','SUV','Lahore',24000,5,'Automatic','Petrol','A confident crossover with comfortable seating for longer journeys.','/cars/tucson.jpg'),
('toyota-fortuner-islamabad','Toyota','Fortuner','SUV','Islamabad',38000,7,'Automatic','Diesel','A spacious seven-seat SUV for group travel and weekend adventures.','/cars/fortuner.jpg')
ON CONFLICT (slug) DO NOTHING;
