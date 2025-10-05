
import fs from 'fs'
import path from 'path'

const LOG_DIR = 'logs'
const LOG_FILE = path.join(LOG_DIR, 'app.log')

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
}

// Reset log file on each run
fs.writeFileSync(LOG_FILE, '', 'utf-8')

const log = (...what: any[]): void => {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] ${what.join(' ')}\n`

    // Log to console
    console.log(...what)
    
    // Log to file
    try {
        fs.appendFileSync(LOG_FILE, logMessage)
    } catch (error) {
        console.error('Failed to write to log file:', error)
    }
}

export default log
