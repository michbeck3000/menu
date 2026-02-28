import React from 'react';

export default function MenuCard({ dish }) {
    const { bistro, name, price, type } = dish;

    return (
        <div className="glass-card p-4 flex flex-col justify-between h-full cursor-default">
            <div className="mb-2">
                <h3 className="text-lg font-semibold text-slate-100 leading-tight transition-colors duration-300">{name}</h3>
                {dish.description && (
                    <p className="text-sm text-slate-100 mt-1 transition-colors duration-300">{dish.description}</p>
                )}
            </div>
            {price && (
                <div className="mt-2 flex justify-end items-center">
                    <span className="text-lg font-bold text-primary-400 transition-colors duration-300">{price}</span>
                </div>
            )}
        </div>
    );
}
