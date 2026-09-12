let isDbUnavailable = false;

export async function dbSafe<T>(prismaFn: () => Promise<T>, fallbackFn: () => Promise<T> | T): Promise<T> {
  if (isDbUnavailable) {
    return fallbackFn();
  }

  try {
    return await prismaFn();
  } catch (err: any) {
    // Check if error is database connection/unreachable error
    const isConnError =
      err.code === 'P1001' || // Can't reach database server
      err.code === 'P1002' || // Database server was reached but timed out
      err.code === 'P1003' || // Database does not exist
      err.name === 'PrismaClientInitializationError' ||
      err.message?.includes('Can\'t reach database server') ||
      err.message?.includes('connect ECONNREFUSED');

    if (isConnError) {
      if (!isDbUnavailable) {
        console.warn('⚠️ [WealthSync] PostgreSQL database server is currently unreachable on localhost:5432. Activating resilient in-memory development state so the application runs seamlessly.');
        isDbUnavailable = true;
      }
      return fallbackFn();
    }

    // If it's another application error, rethrow
    throw err;
  }
}
