import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { pool } from '../db/pool.js';
const router = Router();
const fields = `id,slug,brand,model,category,city,daily_rate,seats,transmission,fuel_type,description,image_path,is_active`;
const cities = ['Lahore','Islamabad','Karachi','Faisalabad','Multan','Peshawar'];
const categories = ['Economy','Sedan','SUV','Luxury'];
const dateOnly = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) === value;
router.get('/health', async (req,res,next) => { try { await pool.query('SELECT 1'); res.json({status:'ok',database:'connected'}); } catch(e) { next(e); } });
router.get('/cars', async (req,res,next) => {
  try {
    const {city,category,maxPrice,pickupDate,returnDate,sort} = req.query;
    if (city && !cities.includes(city)) return res.status(400).json({error:{code:'INVALID_CITY',message:'Choose a supported Pakistani city.'}});
    if (category && !categories.includes(category)) return res.status(400).json({error:{code:'INVALID_CATEGORY',message:'Choose a supported vehicle category.'}});
    if (maxPrice !== undefined && (!Number.isFinite(Number(maxPrice)) || Number(maxPrice)<0)) return res.status(400).json({error:{code:'INVALID_PRICE',message:'Maximum price must be a non-negative number.'}});
    if ((pickupDate && !dateOnly(pickupDate)) || (returnDate && !dateOnly(returnDate)) || Boolean(pickupDate) !== Boolean(returnDate) || (pickupDate && returnDate <= pickupDate)) return res.status(400).json({error:{code:'INVALID_DATES',message:'Provide valid pickup and return dates, with return after pickup.'}});
    const values=[]; const where=['c.is_active = TRUE'];
    if(city){values.push(city);where.push(`c.city=$${values.length}`)}
    if(category){values.push(category);where.push(`c.category=$${values.length}`)}
    if(maxPrice!==undefined){values.push(Number(maxPrice));where.push(`c.daily_rate<=$${values.length}`)}
    let availability='';
    if(pickupDate){values.push(pickupDate,returnDate);availability=`AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.car_id=c.id AND b.status IN ('pending','confirmed') AND $${values.length-1}::date < b.return_date AND $${values.length}::date > b.pickup_date)`}
    const order=sort==='price_desc'?'c.daily_rate DESC':'c.daily_rate ASC';
    const result=await pool.query(`SELECT ${fields} FROM cars c WHERE ${where.join(' AND ')} ${availability} ORDER BY ${order}`,values);
    res.json({cars:result.rows});
  }catch(e){next(e)}
});
router.get('/cars/:id', async(req,res,next)=>{try{const result=await pool.query(`SELECT ${fields} FROM cars WHERE (id::text=$1 OR slug=$1) AND is_active=TRUE`,[req.params.id]);if(!result.rowCount)return res.status(404).json({error:{code:'CAR_NOT_FOUND',message:'This vehicle could not be found.'}});res.json({car:result.rows[0]})}catch(e){next(e)}});
router.post('/bookings', async(req,res,next)=>{
  const {carId,customerName,phone,email,pickupCity,pickupDate,returnDate}=req.body||{};
  const name=String(customerName||'').trim(); const normalizedPhone=String(phone||'').replace(/[\s()-]/g,'');
  if(!Number.isInteger(Number(carId))||!name||name.length>100||!/^((03\d{9})|(\+923\d{9}))$/.test(normalizedPhone)|| (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || !cities.includes(pickupCity) || !dateOnly(pickupDate)||!dateOnly(returnDate)) return res.status(400).json({error:{code:'INVALID_BOOKING',message:'Check the required fields, phone number, city and dates.'}});
  if(returnDate<=pickupDate||pickupDate<new Date().toISOString().slice(0,10)) return res.status(400).json({error:{code:'INVALID_DATES',message:'Pickup must be today or later, and return must be after pickup.'}});
  const days=(Date.parse(`${returnDate}T00:00:00Z`)-Date.parse(`${pickupDate}T00:00:00Z`))/86400000;
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const carResult=await client.query('SELECT id,brand,model,city,daily_rate,is_active FROM cars WHERE id=$1 FOR UPDATE',[Number(carId)]);
    const car=carResult.rows[0]; if(!car||!car.is_active){await client.query('ROLLBACK');return res.status(404).json({error:{code:'CAR_NOT_FOUND',message:'This vehicle is no longer available.'}})}
    const conflict=await client.query("SELECT 1 FROM bookings WHERE car_id=$1 AND status IN ('pending','confirmed') AND $2::date < return_date AND $3::date > pickup_date",[car.id,pickupDate,returnDate]);
    if(conflict.rowCount){await client.query('ROLLBACK');return res.status(409).json({error:{code:'DATES_UNAVAILABLE',message:'This vehicle is booked for some or all of those dates.'}})}
    const reference=`RW-${randomBytes(6).toString('hex').toUpperCase()}`;
    const inserted=await client.query(`INSERT INTO bookings(booking_reference,car_id,customer_name,customer_phone,customer_email,pickup_city,pickup_date,return_date,total_days,total_price,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'confirmed') RETURNING booking_reference`,[reference,car.id,name,normalizedPhone,email||null,pickupCity,pickupDate,returnDate,days,Number(car.daily_rate)*days]);
    await client.query('COMMIT'); res.status(201).json({booking:{reference:inserted.rows[0].booking_reference}});
  }catch(e){await client.query('ROLLBACK').catch(()=>{});next(e)}finally{client.release()}
});
router.get('/bookings/:reference',async(req,res,next)=>{try{
  if(!/^RW-[A-F0-9]{12}$/i.test(req.params.reference))return res.status(404).json({error:{code:'BOOKING_NOT_FOUND',message:'No booking was found with that reference.'}});
  const result=await pool.query(`SELECT b.booking_reference,b.pickup_city,b.pickup_date,b.return_date,b.total_days,b.total_price,b.status,c.brand,c.model,c.category,c.image_path FROM bookings b JOIN cars c ON c.id=b.car_id WHERE b.booking_reference=$1`,[req.params.reference.toUpperCase()]);
  if(!result.rowCount)return res.status(404).json({error:{code:'BOOKING_NOT_FOUND',message:'No booking was found with that reference.'}});res.json({booking:result.rows[0]});
}catch(e){next(e)}});
export default router;
