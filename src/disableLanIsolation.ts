import 'dotenv/config'
import puppeteer from 'puppeteer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import log from './logging.js'

const USER_DATA_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../puppeteer_isolated_profile',
)

let browser: puppeteer.Browser | null = null

const sleep: (ms: number) => Promise<void> = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

const setupPreferences = async () => {
    log('Setting up browser preferences...')

    // Launch a temporary browser instance to create the user data directory
    const browserToExtractPreferences = await puppeteer.launch({
        headless: process.env.HEADLESS === 'true',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-features=PasswordLeakDetection',
            '--disable-save-password-bubble',
        ],
        userDataDir: USER_DATA_DIR,
        executablePath: process.env.CHROMIUM_PATH || undefined,
    })
    await browserToExtractPreferences.close()

    // Modify the Preferences file to disable password saving prompts
    const preferencesPath = path.join(USER_DATA_DIR, 'Default', 'Preferences')
    if (fs.existsSync(preferencesPath)) {
        const preferences = JSON.parse(
            fs.readFileSync(preferencesPath, 'utf-8'),
        )

        if (preferences.profile) {
            preferences.profile.password_manager_leak_detection = false
        } else {
            preferences.profile = { password_manager_leak_detection: false }
        }

        fs.writeFileSync(preferencesPath, JSON.stringify(preferences, null, 2))
    }

    // Make the Preferences file read-only to prevent changes
    fs.chmodSync(preferencesPath, 0o444)
}

const initializeBrowser: () => Promise<void> = async () => {
    log('Opening browser...')
    await setupPreferences()

    browser = await puppeteer.launch({
        headless: process.env.HEADLESS === 'true',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-features=PasswordLeakDetection',
            '--disable-save-password-bubble',
        ],
        userDataDir: USER_DATA_DIR,
        executablePath: process.env.CHROMIUM_PATH || undefined,
    })
}

const login: (page: puppeteer.Page) => Promise<void> = async (page) => {
    log('Logging in...')

    if (!process.env.URL || !process.env.USERNAME || !process.env.PASSWORD) {
        throw new Error(
            'Missing URL, USERNAME, or PASSWORD in environment variables',
        )
    }

    await page.goto(process.env.URL, { waitUntil: 'networkidle2' })
    await page.type('input[name="Username"]', process.env.USERNAME)
    await page.type('input[name="Password"]', process.env.PASSWORD)
    await Promise.all([
        page.click('input[type="submit"]'),
        page.waitForNavigation({ waitUntil: 'networkidle2' }),
    ])
    log('Logged in successfully')
}

const navigateToLanSettings: (
    page: puppeteer.Page,
) => Promise<puppeteer.Frame> = async (page) => {
    log('Navigating to LAN settings...')

    await page.waitForSelector('iframe[id="mainFrame"]', { timeout: 5000 })

    const iframe = await page.$('iframe[id="mainFrame"]')
    log('Found iframe', iframe ? '✅' : '❌')

    const frame = await iframe?.contentFrame()
    log('Got iframe content frame', frame ? '✅' : '❌')

    if (!frame) {
        throw new Error('Failed to get iframe content frame')
    }

    const td_mmNet = await frame?.$('td[id="mmNet"]')
    log('Found Network menu item', td_mmNet ? '✅' : '❌')

    const tr_Network = await td_mmNet?.evaluateHandle(
        (node) => node?.parentElement,
    )
    log('Got Network menu row', tr_Network ? '✅' : '❌')

    await tr_Network?.click()

    await frame?.waitForSelector('font[id="smAddMgr"]', { timeout: 5000 })

    const font_smAddMgr = await frame?.$('font[id="smAddMgr"]')
    log('Found LAN Settings submenu item', font_smAddMgr ? '✅' : '❌')

    const tr_LAN = await font_smAddMgr?.evaluateHandle(
        (node) => node?.parentElement?.parentElement,
    )
    log('Got LAN Settings menu row', tr_LAN ? '✅' : '❌')

    await Promise.all([
        tr_LAN?.click(),
        frame?.waitForNavigation({ waitUntil: 'networkidle2' }),
    ])

    log('Navigation completed successfully')

    return frame
}

const doDisable: (
    page: puppeteer.Page,
    frame: puppeteer.Frame,
) => Promise<void> = async (page, frame) => {
    await frame.waitForSelector('input[name="Frm_IsolateEnable"]', {
        timeout: 5000,
    })

    const input_IsolateEnable = await frame.$('input[name="Frm_IsolateEnable"]')
    log(
        'Found LAN Isolation checkbox',
        input_IsolateEnable ? '✅' : '❌',
    )

    // Check if the checkbox is already unchecked
    const isChecked = await input_IsolateEnable?.evaluate((el) => el.checked)

    if (!isChecked) {
        log('LAN Isolation is already disabled ✅')
        return
    }

    await input_IsolateEnable?.click()
    log('Clicked LAN Isolation checkbox')

    const input_Apply = await frame.$('input[id="Btn_Submit"]')
    log('Found Apply button', input_Apply ? '✅' : '❌')

    await input_Apply?.click()
    log('Clicked Apply button')

    await frame.waitForNavigation({ waitUntil: 'networkidle2' })

    log('LAN Isolation disabled successfully ✅')
}

const disableLanIsolation: () => Promise<void> = async () => {
    await initializeBrowser()

    try {
        const page = await browser!.newPage()
        await sleep(500)

        await login(page)
        await sleep(500)

        const frame = await navigateToLanSettings(page)
        await sleep(500)

        await doDisable(page, frame)
        await sleep(500)
        
        log('All done! Exiting...')

        closeBrowser()
        process.exit(0)
    } catch (error) {
        closeBrowser()
        throw error
    }
}

export const closeBrowser: () => Promise<void> = async () => {
    if (browser) {
        await browser.close()
        browser = null
    }
}

export default disableLanIsolation
