import React, { useState, useEffect, useRef } from 'react';
import './App.css';

interface Country {
  name: {
    common: string;
    official: string;
  };
  cca2: string; // 2-letter country code
  flags: {
    png: string;
    svg: string;
  };
  capital?: string[];
  population: number;
  region: string;
  independent: boolean; // true for sovereign countries, false for territories
}

// Utility functions for daily flag tracking
const getTodayKey = () => {
  const today = new Date();
  return `flag-game-${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
};

const loadCompletedToday = (): Set<string> => {
  try {
    const todayKey = getTodayKey();
    const stored = localStorage.getItem(todayKey);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
};

const saveCompletedToday = (completed: Set<string>) => {
  try {
    const todayKey = getTodayKey();
    localStorage.setItem(todayKey, JSON.stringify(Array.from(completed)));
  } catch {
    // Silently fail if localStorage is not available
  }
};

function App() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFlag, setCurrentFlag] = useState<Country | null>(null);
  const [userGuess, setUserGuess] = useState('');
  const [suggestions, setSuggestions] = useState<Country[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [notification, setNotification] = useState<{
    type: 'success' | 'failure' | 'hint-success';
    message: string;
    country: string;
  } | null>(null);
  const [streak, setStreak] = useState(0);
  const [completedToday, setCompletedToday] = useState<Set<string>>(() => loadCompletedToday());
  const [showEpicCelebration, setShowEpicCelebration] = useState(false);
  const [hintUsedForCurrentFlag, setHintUsedForCurrentFlag] = useState(false);
  const [hintLettersRevealed, setHintLettersRevealed] = useState(0);
  const [showHintTooltip, setShowHintTooltip] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCountries();
  }, []);

  // Auto-start the game when countries are loaded
  useEffect(() => {
    if (countries.length > 0 && !currentFlag) {
      getRandomFlag();
    }
  }, [countries, completedToday]);

  // Focus input when new flag appears or page loads
  useEffect(() => {
    if (currentFlag && inputRef.current) {
      // Small delay to ensure the input is rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [currentFlag]);

  // Focus input on initial mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Clean up old localStorage entries and check for day change
  useEffect(() => {
    const cleanup = () => {
      try {
        const today = getTodayKey();
        const keys = Object.keys(localStorage).filter(key => key.startsWith('flag-game-'));
        keys.forEach(key => {
          if (key !== today) {
            localStorage.removeItem(key);
          }
        });
      } catch {
        // Silently fail if localStorage is not available
      }
    };

    cleanup();
    
    // Check every minute if day has changed (for users who keep app open across midnight)
    const interval = setInterval(() => {
      const currentCompleted = loadCompletedToday();
      if (currentCompleted.size !== completedToday.size || 
          !Array.from(currentCompleted).every(item => completedToday.has(item))) {
        setCompletedToday(currentCompleted);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [completedToday]);

  const fetchCountries = async () => {
    try {
      setLoading(true);
      const response = await fetch('https://restcountries.com/v3.1/all?fields=name,cca2,flags,capital,population,region,independent');
      
      if (!response.ok) {
        throw new Error('Failed to fetch countries');
      }
      
      const data: Country[] = await response.json();
      
      // Filter to only include sovereign countries (independent: true)
      const sovereignCountries = data.filter(country => country.independent === true);
      
      // Sort countries alphabetically by common name
      const sortedCountries = sovereignCountries.sort((a, b) => 
        a.name.common.localeCompare(b.name.common)
      );
      
      // Clear localStorage to prevent issues with old non-sovereign country data
      // This ensures we start fresh with only sovereign countries
      const todayKey = getTodayKey();
      const currentCompleted = loadCompletedToday();
      const validCompleted = Array.from(currentCompleted).filter(code => 
        sortedCountries.some(country => country.cca2 === code)
      );
      
      if (validCompleted.length !== currentCompleted.size) {
        saveCompletedToday(new Set(validCompleted));
        setCompletedToday(new Set(validCompleted));
      }
      
      setCountries(sortedCountries);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getSuggestions = (input: string): Country[] => {
    if (!input.trim()) return [];
    
    const searchTerm = input.toLowerCase().trim();
    return countries.filter(country => {
      const countryName = country.name.common.toLowerCase();
      
      // Check if it matches the beginning of the full country name
      if (countryName.startsWith(searchTerm)) {
        return true;
      }
      
      // For multi-word countries, check if it matches the beginning of any word
      const words = countryName.split(/\s+/); // Split on whitespace
      if (words.length > 1) {
        return words.some(word => word.startsWith(searchTerm));
      }
      
      // For single-word countries, only match if it starts with the search term (already checked above)
      return false;
    }).slice(0, 8); // Limit to 8 suggestions for better UX
  };

  const getRandomFlag = () => {
    if (countries.length === 0) return;
    
    // Filter out countries that have been completed today
    const availableCountries = countries.filter(country => 
      !completedToday.has(country.cca2)
    );
    
    // If all countries have been completed today, show EPIC celebration
    if (availableCountries.length === 0) {
      setShowEpicCelebration(true);
      return;
    }
    
    const randomIndex = Math.floor(Math.random() * availableCountries.length);
    const selectedCountry = availableCountries[randomIndex];
    setCurrentFlag(selectedCountry);
    setUserGuess('');
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    
    // Reset hint flags for new flag
    setHintUsedForCurrentFlag(false);
    setHintLettersRevealed(0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUserGuess(value);
    
    // Hide hint tooltip when user starts typing
    setShowHintTooltip(false);
    
    const newSuggestions = getSuggestions(value);
    setSuggestions(newSuggestions);
    const shouldShowSuggestions = value.length > 0 && newSuggestions.length > 0;
    setShowSuggestions(shouldShowSuggestions);
    
    // Hide hint tooltip when autocomplete opens
    if (shouldShowSuggestions) {
      setShowHintTooltip(false);
    }
    setSelectedSuggestionIndex(-1);
  };

  const handleSuggestionClick = (country: Country) => {
    setUserGuess(country.name.common);
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedSuggestionIndex(-1);
    
    // Submit the guess immediately
    if (currentFlag) {
      const guess = country.name.common.toLowerCase();
      const correctAnswer = currentFlag.name.common.toLowerCase();
      
          if (guess === correctAnswer) {
      // Only increment streak if no hint was used for this flag
      const newStreak = hintUsedForCurrentFlag ? 0 : streak + 1;
      setStreak(newStreak);
      
      // Only add to completed flags if no hint was used
      if (!hintUsedForCurrentFlag) {
        const newCompleted = new Set(completedToday);
        newCompleted.add(currentFlag.cca2);
        setCompletedToday(newCompleted);
        saveCompletedToday(newCompleted);
      }
      
      setNotification({
        type: hintUsedForCurrentFlag ? 'hint-success' : 'success',
        message: hintUsedForCurrentFlag ? 'Correct! (with hint)' : 'Correct!',
        country: currentFlag.name.common
      });
    } else {
      setStreak(0);
      setNotification({
        type: 'failure',
        message: 'Incorrect.',
        country: currentFlag.name.common
      });
    }
      
      // Get a new random flag for the next round
      getRandomFlag();
      
      // Ensure input stays focused after clicking suggestion
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };



  const handleHint = () => {
    if (!currentFlag) return;
    
    // Reset streak as penalty for using hint (only on first hint use)
    if (!hintUsedForCurrentFlag) {
      setStreak(0);
    }
    
    // Mark that hint was used for this flag
    setHintUsedForCurrentFlag(true);
    
    // Reveal one more letter each time
    const newLettersRevealed = Math.min(hintLettersRevealed + 1, currentFlag.name.common.length);
    setHintLettersRevealed(newLettersRevealed);
    
    // Put the revealed letters in the input
    const revealedText = currentFlag.name.common.substring(0, newLettersRevealed);
    setUserGuess(revealedText);
    
    // Hide suggestions
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    
    // Focus back to input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') {
        handleSubmitGuess(e as any);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        const nextIndex = selectedSuggestionIndex < suggestions.length - 1 ? selectedSuggestionIndex + 1 : 0;
        setSelectedSuggestionIndex(nextIndex);
        setUserGuess(suggestions[nextIndex].name.common);
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        const prevIndex = selectedSuggestionIndex > 0 ? selectedSuggestionIndex - 1 : suggestions.length - 1;
        setSelectedSuggestionIndex(prevIndex);
        setUserGuess(suggestions[prevIndex].name.common);
        break;
        
      case 'Enter':
        e.preventDefault();
        handleSubmitGuess(e as any);
        break;
        
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  };

  const handleSubmitGuess = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentFlag || !userGuess.trim()) return;
    
    // Hide suggestions when submitting
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    
    const guess = userGuess.trim().toLowerCase();
    const correctAnswer = currentFlag.name.common.toLowerCase();
    
    if (guess === correctAnswer) {
      // Only increment streak if no hint was used for this flag
      const newStreak = hintUsedForCurrentFlag ? 0 : streak + 1;
      setStreak(newStreak);
      
      // Only add to completed flags if no hint was used
      if (!hintUsedForCurrentFlag) {
        const newCompleted = new Set(completedToday);
        newCompleted.add(currentFlag.cca2);
        setCompletedToday(newCompleted);
        saveCompletedToday(newCompleted);
      }
      
      setNotification({
        type: hintUsedForCurrentFlag ? 'hint-success' : 'success',
        message: hintUsedForCurrentFlag ? 'Correct! (with hint)' : 'Correct!',
        country: currentFlag.name.common
      });
    } else {
      setStreak(0);
      setNotification({
        type: 'failure',
        message: 'Incorrect.',
        country: currentFlag.name.common
      });
    }
    
    // Get a new random flag for the next round
    getRandomFlag();
    
    // Ensure input stays focused after submission
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };





  if (loading) {
    return (
      <div className="App">
        <header>
          <h1>Willa's Flag Game</h1>
        </header>
        <main>
          <div className="loading">Loading countries and flags...</div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="App">
        <header>
          <h1>The Flag Game</h1>
        </header>
        <main>
          <div className="error">
            <p>Error: {error}</p>
            <button onClick={fetchCountries}>Retry</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="App">
      <header>
        <h1>Willa's Flag Game</h1>
      </header>
      <main>


        {currentFlag && (
          <div className="game-area">
            <div className="current-flag">
              <img 
                src={currentFlag.flags.png} 
                alt="Guess this flag"
                className="game-flag-image"
              />
            </div>
            
            <div className="guess-section">
              <h3>What country is this?</h3>
              <p className="progress-indicator">
                {countries.length - completedToday.size} flags remaining today
              </p>
              <form onSubmit={handleSubmitGuess} className="guess-form">
                <div className="input-container">
                  <input
                    ref={inputRef}
                    type="text"
                    value={userGuess}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your guess here..."
                    className="guess-input"
                    autoComplete="off"
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="suggestions-dropdown">
                      {suggestions.map((country, index) => (
                        <div
                          key={country.cca2}
                          className={`suggestion-item ${
                            index === selectedSuggestionIndex ? 'selected' : ''
                          }`}
                          onClick={() => handleSuggestionClick(country)}
                        >
                          <span className="suggestion-name">{country.name.common}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="button-container">
                  <span 
                    className="hint-link"
                    onClick={handleHint}
                    onMouseEnter={() => setShowHintTooltip(true)}
                    onMouseLeave={() => setShowHintTooltip(false)}
                  >
                    Hint
                    {showHintTooltip && (
                      <div className="hint-tooltip">
                        Hint-assisted answers will break your streak.
                      </div>
                    )}
                  </span>
                  <button 
                    type="submit" 
                    className="submit-button"
                    disabled={!userGuess.trim()}
                  >
                    Submit Guess
                  </button>
                </div>
              </form>
              <p className="hint">
                Type to see suggestions • Use ↑↓ arrows to navigate • Press Enter to submit • Hint resets your streak
              </p>
            </div>
          </div>
        )}
        

      </main>
      
      {notification && (
        <div className={`notification ${notification.type}`}>
          <div className="streak-display">
            Streak: {streak}
          </div>
          <div className="notification-content">
            {notification.type === 'success' || notification.type === 'hint-success' ? (
              <>
                <div className="notification-icon">🎉</div>
                <div className="notification-text">
                  <strong>{notification.message}</strong>
                  <div>That is {notification.country}!</div>
                </div>
              </>
            ) : (
              <>
                <div className="notification-icon">😢</div>
                <div className="notification-text">
                  <strong>{notification.message}</strong>
                  <div>That was {notification.country}.</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showEpicCelebration && (
        <div className="epic-celebration-overlay">
          <div className="confetti-container">
            {Array.from({ length: 50 }).map((_, i) => (
              <div key={i} className={`confetti confetti-${i % 6}`} style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${3 + Math.random() * 2}s`
              }}></div>
            ))}
          </div>
          
          <div className="epic-celebration-content">
            <div className="celebration-title">🏆 LEGENDARY ACHIEVEMENT UNLOCKED! 🏆</div>
            
            <div className="celebration-subtitle">
              ✨ ULTIMATE FLAG MASTER ✨
            </div>
            
            <div className="celebration-fireworks">
              🎆 🎇 ✨ 🎊 🌟 ⭐ 💫 🎆 🎇 ✨
            </div>
            
            <div className="celebration-message">
              <div className="celebration-line">🌍 You have conquered EVERY SINGLE FLAG on planet Earth! 🌍</div>
              <div className="celebration-line">👑 You are now officially a GEOGRAPHY LEGEND! 👑</div>
              <div className="celebration-line">🚀 Your knowledge spans all {countries.length} countries! 🚀</div>
              <div className="celebration-line">🔥 The entire world bows to your INCREDIBLE prowess! 🔥</div>
              <div className="celebration-line">⚡ You have achieved what few dare to attempt! ⚡</div>
            </div>
            
            <div className="celebration-stats">
              <div className="stat-item">
                <div className="stat-number">{countries.length}</div>
                <div className="stat-label">FLAGS MASTERED</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">100%</div>
                <div className="stat-label">COMPLETION RATE</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">∞</div>
                <div className="stat-label">AWESOMENESS LEVEL</div>
              </div>
            </div>
            
            <div className="celebration-final">
              🎉 COME BACK TOMORROW FOR A FRESH CHALLENGE! 🎉
            </div>
            
            <button 
              className="celebration-close-btn"
              onClick={() => {
                setShowEpicCelebration(false);
                // Focus input after closing celebration
                setTimeout(() => {
                  inputRef.current?.focus();
                }, 100);
              }}
            >
              I AM THE CHAMPION! 🏆
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
