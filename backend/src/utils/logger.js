export const logger = {
  info: (...args) => console.log(`[INFO ${new Date().toLocaleTimeString()}]`, ...args),
  warn: (...args) => console.warn(`[WARN ${new Date().toLocaleTimeString()}]`, ...args),
  error: (...args) => console.error(`[ERROR ${new Date().toLocaleTimeString()}]`, ...args),
  debug: (...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEBUG ${new Date().toLocaleTimeString()}]`, ...args);
    }
  },
};
