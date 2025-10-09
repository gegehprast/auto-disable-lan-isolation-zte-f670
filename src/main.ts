import 'dotenv/config'
import disableLanIsolation, { closeBrowser } from './disableLanIsolation.js'
import log from './logging.js'

// Global error handlers
let isShuttingDown = false

const handleError = (error: Error, source: string): void => {
    log(`[APP] Error: ${error.name} - ${error.message}`)

    if (!isShuttingDown) {
        log('[APP] Fatal error detected, initiating shutdown...')
        gracefulShutdown(1)
    }
}

const gracefulShutdown = async (exitCode: number = 0): Promise<void> => {
    if (isShuttingDown) {
        log('[APP] Shutdown already in progress...')
        return
    }

    isShuttingDown = true
    log('[APP] Initiating graceful shutdown...')

    try {
        // Give the application time to finish processing
        const shutdownTimeout = setTimeout(() => {
            console.error('[APP] Graceful shutdown timed out, forcing exit')
            process.exit(1)
        }, 60000) // 60 second timeout

        closeBrowser()
        clearTimeout(shutdownTimeout)

        log('[APP] Graceful shutdown completed')
        process.exit(exitCode)
    } catch (error) {
        console.error('[APP] Error during graceful shutdown:', error)
        process.exit(1)
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<any>) => {
    const error = reason instanceof Error ? reason : new Error(String(reason))
    handleError(error, 'Unhandled Promise Rejection')
})

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error, origin: string) => {
    handleError(error, `Uncaught Exception (${origin})`)
})

// Handle termination signals for graceful shutdown
const terminationSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGQUIT']

terminationSignals.forEach((signal) => {
    process.on(signal, () => {
        log(`[APP] Received ${signal}`)
        gracefulShutdown(0)
    })
})

// Handle process warnings
process.on('warning', (warning) => {
    console.warn('[APP] Process Warning:', warning.name, warning.message)
    if (warning.stack) {
        console.warn(warning.stack)
    }
})

disableLanIsolation().catch((error) => {
    handleError(error, 'Main Function Error')
})
