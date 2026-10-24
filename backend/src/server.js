import 'dotenv/config';
import app from './app.js';
import {pool} from './db/pool.js';
const port=process.env.PORT||3000;
async function start(){
  let connected=false;
  for(let attempt=1;attempt<=15;attempt++){
    try{await pool.query('SELECT 1');connected=true;break}catch(error){console.log(`Database not ready (attempt ${attempt}/15).`);await new Promise(r=>setTimeout(r,2000))}
  }
  if(!connected)throw new Error('Could not connect to PostgreSQL. Check DATABASE_URL and database status.');
  const server=app.listen(port,()=>console.log(`RentWheels API listening on port ${port}`));
  const shutdown=()=>server.close(async()=>{await pool.end();process.exit(0)});
  process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
}
start().catch(error=>{console.error(error.message);process.exit(1)});
