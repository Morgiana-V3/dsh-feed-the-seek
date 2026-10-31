import { redactSecrets } from '../privacy/index.js';
/** Attempts per job before it waits for a manual retry. */
export const MAX_JOB_ATTEMPTS = 3;
/** Jobs of one owner: the scope lives in the payload, so filtering and limiting happen in SQL. */
const OWNER = "json_extract(payload,'$.scope.user')=? AND json_extract(payload,'$.scope.persona')=?";
/** Uses the Store's connection so completion participates in the memory transaction. */
export class LearningJobs {
    database;
    constructor(database) {
        this.database = database;
    }
    recover() {
        this.database.prepare("UPDATE jobs SET status='pending' WHERE status='running'").run();
    }
    enqueue(id, payload) {
        this.database
            .prepare("INSERT OR IGNORE INTO jobs(id,payload,status,updated_at) VALUES (?,?,'pending',?)")
            .run(id, payload, new Date().toISOString());
    }
    pending() {
        return this.database
            .prepare("SELECT * FROM jobs WHERE status='pending' AND attempts<? ORDER BY updated_at")
            .all(MAX_JOB_ATTEMPTS);
    }
    start(id) {
        this.database.prepare("UPDATE jobs SET status='running',attempts=attempts+1 WHERE id=?").run(id);
    }
    complete(id) {
        this.database
            .prepare("UPDATE jobs SET status='done',error='',updated_at=? WHERE id=?")
            .run(new Date().toISOString(), id);
    }
    /**
     * A failure with attempts left goes back to pending (keeping its error, so the page can say a
     * retry is coming); after the last attempt it stays failed until the user retries.
     */
    fail(id, message) {
        this.database
            .prepare("UPDATE jobs SET status=CASE WHEN attempts<? THEN 'pending' ELSE 'failed' END,error=?,updated_at=? WHERE id=?")
            .run(MAX_JOB_ATTEMPTS, redactSecrets(message).slice(0, 500), new Date().toISOString(), id);
    }
    /** A job that can never run (for example, it lacks the model to organize with). */
    giveUp(id, message) {
        this.database
            .prepare("UPDATE jobs SET status='failed',attempts=?,error=?,updated_at=? WHERE id=?")
            .run(MAX_JOB_ATTEMPTS, redactSecrets(message).slice(0, 500), new Date().toISOString(), id);
    }
    /** Manual retry of one owner's failed jobs, with a fresh attempt budget. */
    retry(scope) {
        this.database
            .prepare(`UPDATE jobs SET status='pending',attempts=0,error='' WHERE status='failed' AND ${OWNER}`)
            .run(scope.user, scope.persona);
    }
    /** Changes whenever one of the owner's listed jobs changes status, attempts or time. */
    changeKey(scope, limit = 20) {
        const row = this.database
            .prepare(`SELECT group_concat(id || ':' || status || ':' || attempts || ':' || coalesce(updated_at, ''), ',') AS jobs FROM (SELECT * FROM jobs WHERE ${OWNER} ORDER BY updated_at DESC LIMIT ?)`)
            .get(scope.user, scope.persona, limit);
        return row?.jobs || '';
    }
    list(scope, limit = 20) {
        const rows = this.database
            .prepare(`SELECT * FROM jobs WHERE ${OWNER} ORDER BY updated_at DESC LIMIT ?`)
            .all(scope.user, scope.persona, limit);
        return rows.map(({ payload: _payload, ...job }) => ({
            ...job,
            error: redactSecrets(job.error),
        }));
    }
}
//# sourceMappingURL=jobs.js.map