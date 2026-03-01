import { useState, useEffect } from 'react';
import axios from 'axios';
import DaySelector from './components/DaySelector';
import BistroCard from './components/BistroCard';
import './App.css';

function App() {
  const [menuData, setMenuData] = useState(null);
  const [activeDay, setActiveDay] = useState('monday');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const getTodayId = () => {
      const currentDayIndex = new Date().getDay();
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      return days[currentDayIndex];
    };

    const fetchData = async (isManualRefresh = false) => {
      try {
        // Use a timestamp as cache-buster to ensure we get the latest data from the server
        const cacheBuster = `?t=${new Date().getTime()}`;
        const response = await axios.get(`${import.meta.env.BASE_URL}data/menus.json${cacheBuster}`);
        setMenuData(response.data);

        // Auto-select current day if it's a weekday and either:
        // 1. It's the initial load
        // 2. We're refreshing and the user hasn't manually navigated away from what was "today"
        const today = getTodayId();
        const isWeekday = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(today);

        if (isWeekday) {
          // If it's a manual refresh (visibility change), we only update if the day has actually changed
          // or if we were already on a weekday. This prevents jumping around if the user is looking at something specific.
          setActiveDay(prev => {
            if (!isManualRefresh || prev === 'monday' || prev === 'tuesday' || prev === 'wednesday' || prev === 'thursday' || prev === 'friday') {
              return today;
            }
            return prev;
          });
        }
      } catch (err) {
        console.error('Error fetching menu data:', err);
        setError('Konnte Menüdaten nicht laden.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Listen for visibility changes (e.g., app resumed from background)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('App resumed, refreshing data...');
        fetchData(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const handleDaySelect = (dayId) => {
    setActiveDay(dayId);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="mb-8 text-center">
          <div className="h-10 bg-white/5 rounded w-64 mx-auto mb-4 animate-pulse"></div>
          <div className="h-4 bg-white/5 rounded w-96 mx-auto animate-pulse"></div>
        </header>
        <div className="flex justify-center space-x-2 mb-6">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-10 w-12 bg-white/5 rounded-full animate-pulse"></div>
          ))}
        </div>
        <div className="space-y-12 mt-12">
          {[1, 2, 3].map(section => (
            <section key={section}>
              <div className="h-8 bg-white/5 rounded w-48 mb-6 animate-pulse"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(card => (
                  <div key={card} className="glass-card p-4 h-32 animate-pulse">
                    <div className="h-6 bg-white/10 rounded w-3/4 mb-3"></div>
                    <div className="h-4 bg-white/5 rounded w-full mb-2"></div>
                    <div className="h-4 bg-white/5 rounded w-5/6"></div>
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
      <header className="mb-8 text-center animate-slide-up glass-card p-8">
        <h1 className="text-4xl font-display font-bold text-slate-100 mb-2 transition-colors duration-300">
          Wochenkarte
        </h1>
        <p className="text-slate-100/80 transition-colors duration-300 max-w-lg mx-auto mb-1">
          für Fraunhofer, Tafelwerk und Bio-City
        </p>
        <div className="text-[10px] uppercase tracking-wider text-slate-100/40 mb-6 transition-colors duration-300">
          Stand: {new Date(menuData.updatedAt).toLocaleString('de-DE')}
        </div>

        <div className="flex justify-center border-t border-white/10 pt-8">
          <DaySelector activeDay={activeDay} onSelectDay={handleDaySelect} />
        </div>
      </header>

      <div className="animate-fade-in space-y-6">

        {currentMenu.length === 0 ? (
          <div className="text-center py-20 bg-white/5 rounded-2xl border border-dashed border-white/10 transition-colors duration-300 backdrop-blur-sm">
            <p className="text-slate-400">Keine Menüdaten für diesen Tag verfügbar.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {bistroOrder.map((bistroName) => {
              const dishes = dishesByBistro[bistroName];
              if (!dishes || dishes.length === 0) return null;

              return (
                <BistroCard
                  key={bistroName}
                  bistroName={bistroName}
                  dishes={dishes}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
