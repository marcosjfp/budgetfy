/**
 * A lightweight wrapper to mimic the Firebase Firestore Timestamp API.
 * This allows the UI components to continue working exactly as before
 * without realising they are dealing with standard Dates from PostgreSQL.
 */
export class AppTimestamp {
  constructor(private date: Date) {}

  toDate(): Date {
    return this.date;
  }

  toMillis(): number {
    return this.date.getTime();
  }

  static fromDate(date: Date): AppTimestamp {
    return new AppTimestamp(date);
  }
  
  static fromMillis(milliseconds: number): AppTimestamp {
    return new AppTimestamp(new Date(milliseconds));
  }

  static now(): AppTimestamp {
    return new AppTimestamp(new Date());
  }
}
