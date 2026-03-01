import React from 'react';

const days = [
    { id: 'monday', label: 'Mo' },
    { id: 'tuesday', label: 'Di' },
    { id: 'wednesday', label: 'Mi' },
    { id: 'thursday', label: 'Do' },
    { id: 'friday', label: 'Fr' },
];

export default function DaySelector({ activeDay, onSelectDay }) {
    return (
        <div className="flex justify-start md:justify-center space-x-2 overflow-x-auto py-2 px-4 no-scrollbar">
            {days.map((day) => (
                <button
                    key={day.id}
                    onClick={() => onSelectDay(day.id)}
                    className={`nav-item ${activeDay === day.id ? 'nav-item-active' : 'nav-item-inactive'
                        }`}
                >
                    {day.label}
                </button>
            ))}
        </div>
    );
}
