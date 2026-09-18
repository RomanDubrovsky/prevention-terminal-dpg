import React, { useState, useEffect } from 'react';

interface Specialist {
    specialist_id: string;
    display_name: string;
    photo_url?: string;
    bio_short?: string;
    price_base: number;
    method_tags: string[];
    online: boolean;
    offline: boolean;
    public_url: string;
}

export const SpecialistDirectory: React.FC = () => {
    const [specialists, setSpecialists] = useState<Specialist[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filters state
    const [maxPrice, setMaxPrice] = useState<number | ''>('');
    const [isOnline, setIsOnline] = useState<boolean>(true);
    const [methodTag, setMethodTag] = useState<string>('');

    const fetchSpecialists = async () => {
        setLoading(true);
        try {
            // Строим query params
            const params = new URLSearchParams();
            if (maxPrice) params.append('max_price', maxPrice.toString());
            if (isOnline) params.append('is_online', 'true');
            if (methodTag) params.append('method_tag', methodTag);
            
            // В реальном приложении здесь будет API_BASE_URL
            const res = await fetch(`/api/directory/specialists?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setSpecialists(data);
            }
        } catch (e) {
            console.error("Failed to load directory", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSpecialists();
    }, [maxPrice, isOnline, methodTag]);

    return (
        <div style={{ display: 'flex', gap: '20px', padding: '20px' }}>
            {/* Sidebar with filters */}
            <aside style={{ width: '250px', borderRight: '1px solid #eee', paddingRight: '20px' }}>
                <h3>Фильтры (IDA Marketplace)</h3>
                
                <div style={{ marginBottom: '15px' }}>
                    <label>Макс. цена (₽)</label>
                    <input 
                        type="number" 
                        value={maxPrice} 
                        onChange={e => setMaxPrice(e.target.value ? Number(e.target.value) : '')}
                        style={{ width: '100%', padding: '5px' }}
                    />
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label>
                        <input 
                            type="checkbox" 
                            checked={isOnline} 
                            onChange={e => setIsOnline(e.target.checked)}
                        />
                        Только онлайн
                    </label>
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label>Подход (Метод)</label>
                    <select 
                        value={methodTag} 
                        onChange={e => setMethodTag(e.target.value)}
                        style={{ width: '100%', padding: '5px' }}
                    >
                        <option value="">Все методы</option>
                        <option value="cbt">КПТ (CBT)</option>
                        <option value="gestalt">Гештальт-терапия</option>
                        <option value="psychoanalysis">Психоанализ</option>
                    </select>
                </div>
            </aside>

            {/* Main content grid */}
            <main style={{ flex: 1 }}>
                <h2>Наши специалисты</h2>
                {loading ? (
                    <p>Загрузка...</p>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                        {specialists.map(s => (
                            <div key={s.specialist_id} style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '8px' }}>
                                {s.photo_url && <img src={s.photo_url} alt={s.display_name} style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '4px' }} />}
                                <h3>{s.display_name}</h3>
                                <p style={{ fontSize: '0.9em', color: '#666' }}>{s.bio_short}</p>
                                <p><strong>Цена:</strong> от {s.price_base} ₽</p>
                                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                    {s.method_tags.map(m => (
                                        <span key={m} style={{ background: '#e0e0e0', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8em' }}>{m}</span>
                                    ))}
                                </div>
                                <a 
                                    href={s.public_url} 
                                    style={{ display: 'block', textAlign: 'center', background: '#007bff', color: '#fff', padding: '10px', textDecoration: 'none', borderRadius: '4px' }}
                                >
                                    Перейти на страницу (записаться)
                                </a>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};
