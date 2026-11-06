package id.muzakie.qrismuz.listener.data.db

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

/** Notifikasi yang ditangkap. Ditulis ke sini dulu, baru dikirim; dihapus setelah 7 hari. */
@Entity(tableName = "events", indices = [Index(value = ["hash"], unique = true), Index("sentAt")])
data class EventEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val hash: String,
    val packageName: String,
    val title: String?,
    val text: String?,
    val bigText: String?,
    val subText: String?,
    val postedAt: Long,
    val notificationKey: String?,
    val appVersion: String?,
    val capturedAt: Long,
    val isTest: Boolean = false,
    val sentAt: Long? = null,
    val attempts: Int = 0,
)

@Dao
interface EventDao {
    /** -1 bila hash sudah ada (notifikasi yang sama tertangkap ulang). */
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(event: EventEntity): Long

    @Query("SELECT * FROM events WHERE sentAt IS NULL ORDER BY capturedAt ASC LIMIT :limit")
    suspend fun unsent(limit: Int): List<EventEntity>

    @Query("UPDATE events SET sentAt = :at WHERE hash IN (:hashes)")
    suspend fun markSent(hashes: List<String>, at: Long)

    @Query("UPDATE events SET attempts = attempts + 1 WHERE id IN (:ids)")
    suspend fun bumpAttempts(ids: List<Long>)

    @Query("SELECT COUNT(*) FROM events WHERE sentAt IS NULL")
    fun unsentCount(): Flow<Int>

    @Query("SELECT COUNT(*) FROM events WHERE sentAt IS NULL")
    suspend fun unsentCountNow(): Int

    @Query("SELECT * FROM events WHERE capturedAt >= :since ORDER BY capturedAt DESC LIMIT :limit")
    fun recent(since: Long, limit: Int): Flow<List<EventEntity>>

    @Query("DELETE FROM events WHERE capturedAt < :before AND sentAt IS NOT NULL")
    suspend fun pruneSent(before: Long)

    @Query("DELETE FROM events")
    suspend fun clear()
}

@Database(entities = [EventEntity::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun events(): EventDao

    companion object {
        fun create(context: Context): AppDatabase =
            Room.databaseBuilder(context, AppDatabase::class.java, "listener.db").build()
    }
}
