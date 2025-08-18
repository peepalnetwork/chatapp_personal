import { getDatabase } from '../lib/mongodb';
import cron from 'node-cron';
export async function initCron() {
  // every day
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log(`[CRON] Running Deletion job`);
      const db = await getDatabase();
      const settings = await db.collection('systemSettings').findOne({});
      const days = settings?.autoDeletionDays;
      if (!settings || !settings.autoDeletionDays) return;

      const threshold = new Date();
      threshold.setDate(threshold.getDate() - days);

      const result = await db.collection('messages').deleteMany({
        timestamp: { $lt: threshold }
      });

      console.log(`[CRON] Deleted ${result.deletedCount} messages`);
    } catch (error) {}
  });
}
