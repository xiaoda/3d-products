import { defineConfig } from 'vitest/config';

// 密集几何验证是 CPU / 内存任务；避免默认按核心数同时复制多个完整产品。
// 不放宽几何阈值；较长的扫掠/相交检查仍各自在测试中声明超时。
export default defineConfig({ test: { maxWorkers: 2 } });
