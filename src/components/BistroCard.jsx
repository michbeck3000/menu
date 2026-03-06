import React from 'react';

export default function BistroCard({ bistroName, dishes }) {
    return (
        <div className="glass-card p-6 animate-slide-up text-center">
            <h2 className="text-2xl font-display font-bold text-slate-100 mb-5 pb-3 border-b border-white/10 transition-colors duration-300">
                {bistroName}
            </h2>
            <ul className="">
                {dishes.map((dish, index) => {
                    const isVegan = dish.type === 'vegan' || dish.name?.toLowerCase().includes('vegan') || (dish.description && dish.description.toLowerCase().includes('vegan'));
                    const isVegie = dish.type === 'vegetarian' || dish.type === 'vegi' || dish.name?.toLowerCase().includes('vegetarisch') || (dish.description && dish.description.toLowerCase().includes('vegetarisch'));

                    return (
                        <React.Fragment key={`${dish.bistro}-${index}`}>
                            <li className="group">
                                <h3 className="text-base font-semibold text-slate-100 leading-snug transition-colors duration-300">
                                    {dish.name}
                                    {(bistroName === 'Bio-City' || !dish.description) && isVegan && (
                                        <span className="inline-block ml-2 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-primary-600 rounded-full shadow-sm align-middle mb-0.5 whitespace-nowrap">
                                            VEGAN
                                        </span>
                                    )}
                                    {(bistroName === 'Bio-City' || !dish.description) && isVegie && !isVegan && (
                                        <span className="inline-block ml-2 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-primary-600 rounded-full shadow-sm align-middle mb-0.5 whitespace-nowrap">
                                            VEGI
                                        </span>
                                    )}
                                </h3>
                                {dish.description && (
                                    <p className="text-sm text-slate-100 mt-1 transition-colors duration-300">
                                        {dish.description}
                                        {bistroName !== 'Bio-City' && isVegan && (
                                            <span className="inline-block ml-2 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-primary-600 rounded-full shadow-sm align-middle mb-0.5 whitespace-nowrap">
                                                VEGAN
                                            </span>
                                        )}
                                        {bistroName !== 'Bio-City' && isVegie && !isVegan && (
                                            <span className="inline-block ml-2 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-primary-600 rounded-full shadow-sm align-middle mb-0.5 whitespace-nowrap">
                                                VEGI
                                            </span>
                                        )}
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
                    );
                })}
            </ul>
        </div>
    );
}
