import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from "./components/layout/AppShell"
import { Dashboard } from "./views/Dashboard"
import { PokemonList } from "./views/PokemonList"
import { PokemonDetail } from "./views/PokemonDetail"
import { SinnohanList } from "./views/SinnohanList"
import { SinnohanDetail } from "./views/SinnohanDetail"
import { TypesView } from "./views/TypesView"
import { MovesView } from "./views/MovesView"
import { ItemsView } from "./views/ItemsView"
import { EvolutionsView } from "./views/EvolutionsView"
import { TrainersView } from "./views/TrainersView"
import { WildView } from "./views/WildView"
import { EventsView } from "./views/EventsView"
import { GuidesHub } from "./views/guides/GuidesHub"
import { FaqView } from "./views/guides/FaqView"
import { NpcView } from "./views/guides/NpcView"
import { TradesView } from "./views/guides/TradesView"
import { LevelCapsView } from "./views/guides/LevelCapsView"
import { ActionReplayView } from "./views/guides/ActionReplayView"
import { ChangelogView } from "./views/guides/ChangelogView"
import { SearchView } from "./views/SearchView"
import { NotFound } from "./views/NotFound"

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />

          <Route path="pokemon" element={<PokemonList />} />
          <Route path="pokemon/:slug" element={<PokemonDetail />} />

          <Route path="sinnohan" element={<SinnohanList />} />
          <Route path="sinnohan/:slug" element={<SinnohanDetail />} />

          <Route path="types" element={<TypesView />} />
          <Route path="moves" element={<MovesView />} />
          <Route path="items" element={<ItemsView />} />
          <Route path="evolutions" element={<EvolutionsView />} />
          <Route path="trainers" element={<TrainersView />} />
          <Route path="wild" element={<WildView />} />
          <Route path="events" element={<EventsView />} />

          <Route path="guides" element={<GuidesHub />} />
          <Route path="guides/faq" element={<FaqView />} />
          <Route path="guides/npc" element={<NpcView />} />
          <Route path="guides/trades" element={<TradesView />} />
          <Route path="guides/level-caps" element={<LevelCapsView />} />
          <Route path="guides/action-replay" element={<ActionReplayView />} />
          <Route path="guides/changelog" element={<ChangelogView />} />

          <Route path="search" element={<SearchView />} />

          <Route path="index.html" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
