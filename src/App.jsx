import { useState, useEffect } from 'react';
import axios from 'axios';
import DaySelector from './components/DaySelector';
import MenuCard from './components/MenuCard';
import './App.css';

function App() {
  const [menuData, setMenuData] = useState(null);
  const [activeDay, setActiveDay] = useState('monday');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('/data/menus.json');
        setMenuData(response.data);

        // Auto-select current day if available
        const currentDayIndex = new Date().getDay();
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const today = days[currentDayIndex];

        if (['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(today)) {
          setActiveDay(today);
        }

      } catch (err) {
        console.error('Error fetching menu data:', err);
        setError('Konnte Menüdaten nicht laden.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleDaySelect = (dayId) => {
    setActiveDay(dayId);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="mb-8 text-center">
          <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded w-64 mx-auto mb-4 animate-pulse"></div>
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-96 mx-auto animate-pulse"></div>
        </header>
        <div className="flex justify-center space-x-2 mb-6">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-10 w-12 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse"></div>
          ))}
        </div>
        <div className="space-y-12 mt-12">
          {[1, 2, 3].map(section => (
            <section key={section}>
              <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-48 mb-6 animate-pulse"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(card => (
                  <div key={card} className="glass-card p-4 h-32 animate-pulse">
                    <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-3"></div>
                    <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-full mb-2"></div>
                    <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-5/6"></div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen text-red-500">
        {error}
      </div>
    );
  }

  const currentMenu = menuData?.days[activeDay] || [];

  const bistroOrder = ['Fraunhofer', 'Tafelwerk', 'Bio-City'];

  // Helper to group dishes by bistro
  const dishesByBistro = currentMenu.reduce((acc, dish) => {
    const bistro = dish.bistro;
    if (!acc[bistro]) {
      acc[bistro] = [];
    }
    acc[bistro].push(dish);
    return acc;
  }, {});

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <header className="mb-8 text-center animate-slide-up">
        <h1 className="text-4xl font-display font-bold text-slate-900 dark:text-slate-50 mb-2 transition-colors duration-300">
          Bundesbank Menü
        </h1>
        <p className="text-slate-500 dark:text-slate-400 transition-colors duration-300">
          Wochenkarte für Fraunhofer, Tafelwerk und Bio-City
        </p>
        <div className="text-xs text-slate-400 dark:text-slate-500 mt-2 transition-colors duration-300">
          Stand: {new Date(menuData.updatedAt).toLocaleString('de-DE')}
        </div>
      </header>

      <div className="animate-fade-in">
        <DaySelector activeDay={activeDay} onSelectDay={handleDaySelect} />

        {currentMenu.length === 0 ? (
          <div className="text-center py-20 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 transition-colors duration-300">
            <p className="text-slate-500 dark:text-slate-400">Keine Menüdaten für diesen Tag verfügbar.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {bistroOrder.map((bistroName) => {
              const dishes = dishesByBistro[bistroName];
              if (!dishes || dishes.length === 0) return null;

              return (
                <section key={bistroName} className="animate-slide-up">
                  <h2 className="text-2xl font-display font-bold text-slate-800 dark:text-slate-100 mb-4 border-b border-slate-200 dark:border-slate-700 pb-2 transition-colors duration-300">
                    {bistroName}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {dishes.map((dish, index) => (
                      <div
                        key={`${dish.bistro}-${index}`}
                        className="h-full"
                      >
                        <MenuCard dish={dish} />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
