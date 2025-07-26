const os = require('os');

class MemoryMonitor {
  constructor() {
    this.warnings = [];
    this.lastCheck = Date.now();
  }

  // Получить информацию об использовании памяти
  getMemoryInfo() {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    
    return {
      process: {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024) // MB
      },
      system: {
        total: Math.round(totalMem / 1024 / 1024), // MB
        free: Math.round(freeMem / 1024 / 1024), // MB
        used: Math.round((totalMem - freeMem) / 1024 / 1024) // MB
      }
    };
  }

  // Проверить, не превышает ли память лимиты
  checkMemoryLimits() {
    const memInfo = this.getMemoryInfo();
    const warnings = [];

    // Проверяем использование памяти процесса (более строгие лимиты)
    if (memInfo.process.heapUsed > 200) {
      warnings.push(`High heap usage: ${memInfo.process.heapUsed}MB`);
    }

    if (memInfo.process.rss > 300) {
      warnings.push(`High RSS usage: ${memInfo.process.rss}MB`);
    }

    // Проверяем системную память
    const systemUsagePercent = (memInfo.system.used / memInfo.system.total) * 100;
    if (systemUsagePercent > 70) {
      warnings.push(`High system memory usage: ${systemUsagePercent.toFixed(1)}%`);
    }

    return {
      warnings,
      memInfo,
      isCritical: warnings.length > 0
    };
  }

  // Логировать информацию о памяти
  logMemoryInfo(context = '') {
    const memInfo = this.getMemoryInfo();
    const check = this.checkMemoryLimits();
    
    console.log(`[MEMORY_MONITOR] ${context}`, {
      process: memInfo.process,
      system: memInfo.system,
      warnings: check.warnings,
      isCritical: check.isCritical
    });

    if (check.isCritical) {
      console.warn(`[MEMORY_WARNING] ${check.warnings.join(', ')}`);
    }
  }

  // Принудительная очистка памяти
  forceCleanup() {
    if (global.gc) {
      global.gc();
      console.log('[MEMORY_CLEANUP] Garbage collection triggered');
      return true;
    }
    return false;
  }

  // Мониторинг в реальном времени
  startMonitoring(intervalMs = 60000) { // каждую минуту
    setInterval(() => {
      this.logMemoryInfo('Periodic check');
      
      const check = this.checkMemoryLimits();
      if (check.isCritical) {
        console.warn('[MEMORY_CRITICAL] Принудительная очистка памяти');
        this.forceCleanup();
        
        // Если память все еще критична после очистки
        setTimeout(() => {
          const recheck = this.checkMemoryLimits();
          if (recheck.isCritical) {
            console.error('[MEMORY_EMERGENCY] Критический уровень памяти, перезапуск сервера');
            process.exit(1); // Принудительный перезапуск
          }
        }, 5000);
      }
    }, intervalMs);
  }
}

module.exports = new MemoryMonitor(); 