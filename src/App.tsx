import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HomeScreen } from './screens/HomeScreen';
import { TeamSelectionScreen } from './screens/TeamSelectionScreen';
import { WaitingScreen } from './screens/WaitingScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { ActiveClueScreen } from './screens/ActiveClueScreen';
import { SuccessScreen } from './screens/SuccessScreen';
import { TreasureScreen } from './screens/TreasureScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { OrganizerLoginScreen } from './screens/organizer/OrganizerLoginScreen';
import { OrganizerDashboardScreen } from './screens/organizer/OrganizerDashboardScreen';
import { ClueManagementScreen } from './screens/organizer/ClueManagementScreen';
import { OrganizerLeaderboardScreen } from './screens/organizer/OrganizerLeaderboardScreen';
import { OrganizerGuard } from './components/OrganizerGuard';
import { AnimatePresence } from 'framer-motion';
import { PageTransition } from './components/PageTransition';

function AppRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><HomeScreen /></PageTransition>} />
        <Route path="/team" element={<PageTransition><TeamSelectionScreen /></PageTransition>} />
        <Route path="/waiting" element={<PageTransition><WaitingScreen /></PageTransition>} />
        <Route path="/dashboard" element={<PageTransition><DashboardScreen /></PageTransition>} />
        <Route path="/clue/:id" element={<PageTransition><ActiveClueScreen /></PageTransition>} />
        <Route path="/clue/:id/success" element={<PageTransition><SuccessScreen /></PageTransition>} />
        <Route path="/treasure" element={<PageTransition><TreasureScreen /></PageTransition>} />
        <Route path="/leaderboard" element={<PageTransition><LeaderboardScreen /></PageTransition>} />
        <Route path="/organizer" element={<OrganizerLoginScreen />} />
        <Route path="/organizer/dashboard" element={<OrganizerGuard><OrganizerDashboardScreen /></OrganizerGuard>} />
        <Route path="/organizer/clues" element={<OrganizerGuard><ClueManagementScreen /></OrganizerGuard>} />
        <Route path="/organizer/leaderboard" element={<OrganizerGuard><OrganizerLeaderboardScreen /></OrganizerGuard>} />
        <Route path="/profile" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return <BrowserRouter><AppRoutes /></BrowserRouter>;
}

export default App;
