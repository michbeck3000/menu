import React from 'react';

const bistroUrls = {
  'Bio-City': 'https://geschmackswerk-leipzig.de/#wochenkarte',
  'Fraunhofer': 'https://www.cafeteria-leipzig.de/cafeteria-fraunhofer-izi/',
  'Tafelwerk': 'https://www.tafelwerk-leipzig.de/weeklycard',
  'Porta': 'https://porta.de/einrichtungshaeuser/leipzig',
  'Nationalbibliothek': 'https://saxonia-catering.de/saxonia-catering-betriebsrestaurants.html'
};

export default function BistroCard({ bistroName, dishes }) {
  const url = bistroUrls[bistroName];
  
  return (
    <div className="glass-card p-6 animate-slide-up text-center">
      <h2 className="text-2xl font-display font-bold text-slate-100 mb-5 pb-3 border-b border-white/10 transition-colors duration-300">
        {url ? (
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-slate-100 hover:text-primary-400 transition-colors duration-300"
            title={url}
          >
            {bistroName}
          </a>
        ) : (
          bistroName
        )}
      </h2>
            <ul className="">
                {dishes.map((dish, index) => (
                    <React.Fragment key={`${dish.bistro}-${index}`}>
                        <li className="group">
                            {bistroName === 'Porta' && dish.name.toLowerCase().includes('schnitzel') && (
                                <p className="text-sm text-slate-100/70 mb-0.5 transition-colors duration-300">
                                    Aktionsangebot
                                </p>
                            )}
                            <h3 className="text-base font-semibold text-slate-100 leading-snug transition-colors duration-300 flex items-center justify-center gap-2 flex-wrap">
                                <span>{dish.name}</span>
                                {dish.type === 'vegan' && (
                                    <span className="px-1.5 py-0.4 text-[10px] font-bold tracking-wider text-amber-400 bg-slate-700 rounded-full uppercase shadow-sm">
                                        Vegan
                                    </span>
                                )}
                                {dish.type === 'vegetarian' && (
                                    <span className="px-1.5 py-0.4 text-[10px] font-bold tracking-wider text-amber-400 bg-slate-700 rounded-full uppercase shadow-sm">
                                        VEGETARISCH
                                    </span>
                                )}
                            </h3>
                            {dish.description && (
                                <p className="text-sm text-slate-100 mt-0.5 transition-colors duration-300">
                                    {dish.description}
                                </p>
                            )}
                            {dish.price && (
                                <div className="text-sm font-bold text-primary-500 mt-1 transition-colors duration-300">
                                    {dish.price}
                                </div>
                            )}
                        </li>
                        {index < dishes.length - 1 && (
                            <div className="w-20 mx-auto border-t border-white/10 my-4" />
                        )}
                    </React.Fragment>
                ))}
            </ul>
        </div>
    );
}
