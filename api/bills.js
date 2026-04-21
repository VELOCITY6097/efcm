const { Pool } = require('pg');

const DATABASE_URL = "postgresql://neondb_owner:npg_WeBqunU56xPX@ep-lucky-cloud-aozli1uh.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({ connectionString: DATABASE_URL });

export default async function handler(req, res) {
  try {
    // 1. Ensure Tables Exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fuel_bills (
        id BIGINT PRIMARY KEY, bill_no INT, bill_date DATE,
        vehicle_no VARCHAR(50), fuel_type VARCHAR(20),
        qnty NUMERIC(10, 2), rate NUMERIC(10, 2), amount NUMERIC(12, 2)
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        setting_key VARCHAR(50) PRIMARY KEY, 
        setting_value NUMERIC(12, 2)
      );
    `);

    // 2. Handle Settings (Advance Payment)
    if (req.query.type === 'settings') {
      if (req.method === 'GET') {
        const { rows } = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'advance'");
        return res.status(200).json({ advance: rows.length > 0 ? parseFloat(rows[0].setting_value) : 0 });
      } 
      if (req.method === 'POST') {
        await pool.query(`
          INSERT INTO app_settings (setting_key, setting_value) VALUES ('advance', $1) 
          ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value
        `, [req.body.advance]);
        return res.status(200).json({ success: true });
      }
    }

    // 3. Handle Bills (Existing Logic)
    if (req.method === 'GET') {
      const { rows } = await pool.query('SELECT * FROM fuel_bills ORDER BY bill_no');
      const formatted = rows.map(r => ({
        id: parseInt(r.id), billNo: r.bill_no,
        date: r.bill_date.toISOString().split('T')[0],
        vehicleNo: r.vehicle_no, fuelType: r.fuel_type,
        qnty: parseFloat(r.qnty), rate: parseFloat(r.rate), amount: parseFloat(r.amount)
      }));
      return res.status(200).json(formatted);
    } 
    
    else if (req.method === 'POST') {
      const b = req.body;
      const checkDuplicate = await pool.query('SELECT id FROM fuel_bills WHERE bill_no = $1', [b.billNo]);
      if (checkDuplicate.rows.length > 0 && checkDuplicate.rows[0].id != b.id) {
          return res.status(200).json({ success: false, message: "Duplicate" });
      }
      await pool.query(`
        INSERT INTO fuel_bills (id, bill_no, bill_date, vehicle_no, fuel_type, qnty, rate, amount) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET 
        bill_no = EXCLUDED.bill_no, bill_date = EXCLUDED.bill_date, vehicle_no = EXCLUDED.vehicle_no, 
        fuel_type = EXCLUDED.fuel_type, qnty = EXCLUDED.qnty, rate = EXCLUDED.rate, amount = EXCLUDED.amount
      `, [b.id, b.billNo, b.date, b.vehicleNo, b.fuelType, b.qnty, b.rate, b.amount]);
      return res.status(201).json({ success: true });
    } 
    
    else if (req.method === 'DELETE') {
      await pool.query('DELETE FROM fuel_bills WHERE id = $1', [req.body.id]);
      return res.status(200).json({ success: true });
    }

    res.status(405).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
