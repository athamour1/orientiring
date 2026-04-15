export default ({ app }) => {
  app.config.errorHandler = (err, instance, info) => {
    console.error('[Global Vue Error]', err, '\nInfo:', info)
  }

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Unhandled Promise Rejection]', event.reason)
  })
}
