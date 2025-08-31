import { NextResponse } from 'next/server';
import { DatabaseFactory } from '@/lib/database';

export async function GET() {
  try {
    // Database health check
    const db = DatabaseFactory.getInstance();
    const dbHealthy = await db.healthCheck();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: {
        type: process.env.DATABASE_TYPE || 'sqlite',
        healthy: dbHealthy
      },
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      }
    };
    
    if (!dbHealthy) {
      return NextResponse.json(
        { 
          ...health,
          status: 'unhealthy',
          error: 'Database connection failed'
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(health);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: `Health check failed: ${errorMessage}`,
        uptime: process.uptime()
      },
      { status: 503 }
    );
  }
}