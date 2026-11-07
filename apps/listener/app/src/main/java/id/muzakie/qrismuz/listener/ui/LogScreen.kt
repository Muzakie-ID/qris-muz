package id.muzakie.qrismuz.listener.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import id.muzakie.qrismuz.listener.Graph

@Composable
fun LogScreen(onBack: () -> Unit) {
    val since = remember { System.currentTimeMillis() - 7 * 24 * 3600_000L }
    val events by Graph.db.events().recent(since, 300).collectAsState(initial = emptyList())
    LazyColumn(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Header("Log 7 hari", onBack = onBack, subtitle = "${events.size} notifikasi") }
        if (events.isEmpty()) item { Hint("Belum ada notifikasi yang tertangkap.") }
        items(events, key = { it.id }) { e -> Panel { EventRow(e) } }
    }
}
