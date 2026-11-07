package id.muzakie.qrismuz.listener

import android.content.Context
import id.muzakie.qrismuz.listener.data.EventSender
import id.muzakie.qrismuz.listener.data.Prefs
import id.muzakie.qrismuz.listener.data.db.AppDatabase
import id.muzakie.qrismuz.listener.net.ApiClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

/** Objek bersama aplikasi (cukup untuk aplikasi sekecil ini, tanpa DI framework). */
object Graph {
    lateinit var prefs: Prefs
        private set
    lateinit var db: AppDatabase
        private set
    lateinit var api: ApiClient
        private set
    lateinit var sender: EventSender
        private set

    /** Lingkup coroutine yang hidup selama proses aplikasi. */
    val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    fun init(context: Context) {
        prefs = Prefs(context)
        db = AppDatabase.create(context)
        api = ApiClient()
        sender = EventSender(prefs, db.events(), api)
    }
}
