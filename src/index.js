import TickTick from './services/ticktick.js'
import dotenv from 'dotenv';
dotenv.config();


const teste = new TickTick(process.env.TICK_USER, process.env.TICK_PASS)

const login = await teste.login()

// console.log(login.status_code)

console.log(teste.inbox)