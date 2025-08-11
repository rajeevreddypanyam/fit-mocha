import { BrowserRouter as Router, Routes, Route } from "react-router";
import Layout from "@/react-app/components/Layout";
import Home from "@/react-app/pages/Home";
import Workout from "@/react-app/pages/Workout";
import ExerciseList from "@/react-app/pages/ExerciseList";
import WorkoutHistory from "@/react-app/pages/WorkoutHistory";
import Settings from "@/react-app/pages/Settings";
import ProfileEdit from "@/react-app/pages/ProfileEdit";
import ExerciseDetails from "@/react-app/pages/ExerciseDetails";
import AddExercise from "@/react-app/pages/AddExercise";
import EditExercise from "@/react-app/pages/EditExercise";
import StartWorkout from "@/react-app/pages/StartWorkout";
import SelectableExerciseList from "@/react-app/pages/SelectableExerciseList";
import ActiveExercise from "@/react-app/pages/ActiveExercise";
import ActiveSummary from "@/react-app/pages/ActiveSummary";
import HistorySummary from "@/react-app/pages/HistorySummary";
import { SettingsProvider } from "@/react-app/hooks/useSettings";


export default function App() {
  return (
    <SettingsProvider>
      <Router>
        <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/exercises" element={<ExerciseList />} />
          <Route path="/exercises/:id" element={<ExerciseDetails />} />
          <Route path="/exercises/:id/edit" element={<EditExercise />} />
          <Route path="/exercises/new" element={<AddExercise />} />
          <Route path="/workout/start" element={<StartWorkout />} />
          <Route path="/workout/select-exercises" element={<SelectableExerciseList />} />
          <Route path="/workout/exercise/:workoutExerciseId" element={<ActiveExercise />} />
          <Route path="/workout/summary" element={<ActiveSummary />} />
          
          <Route path="/history" element={<WorkoutHistory />} />
          <Route path="/workouts/:id" element={<HistorySummary />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile/edit" element={<ProfileEdit />} />
        </Routes>
      </Layout>
    </Router>
    </SettingsProvider>
  );
}
