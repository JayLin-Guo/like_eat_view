import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { Utensils, RefreshCw, ChevronLeft, Award, User, Sparkles, Send, Loader2, Star, CheckCircle2, ChevronRight, Zap, MapPin } from 'lucide-react';
import confetti from 'canvas-confetti';
import { deepseek, systemPrompts } from './utils/ai';
import './App.css';

// --- Types ---
interface Option {
  id: string;
  label: string;
  description?: string;
}

interface Question {
  id: string;
  title: string;
  options: Option[];
}

interface UserProfile {
  gender: 'male' | 'female' | null;
  region: string | null;
  history: Record<string, string>; // questionId -> optionLabel
}

interface Category {
  id: string;
  name: string;
  color: string;
  description: string;
}

interface Food {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

const REGIONS = [
  { id: 'north', name: '北方豪放派', desc: '面食碳水、牛羊硬菜、咸香浓厚', icon: '🍜' },
  { id: 'south', name: '江南婉约派', desc: '米饭为主、清淡精致、偏爱鲜甜', icon: '🍚' },
  { id: 'spicy', name: '川渝湘辣鬼', desc: '无辣不欢、重油重口、江湖风汇', icon: '🌶️' },
  { id: 'northwest', name: '西北狂野侠', desc: '大口吃肉、生猛碳水、孜然烤肉', icon: '🍖' },
  { id: 'canton', name: '两广福建仔', desc: '早茶点心、原汁原味、靓汤海鲜', icon: '🥟' },
  { id: 'fast', name: '快餐依赖控', desc: '汉堡披萨、炸鸡快乐、省时果腹', icon: '🍔' }
];

const SLOT_HEIGHT = 80; // Height of an individual slot item in px

const App: React.FC = () => {
  const [step, setStep] = useState(0); // 0: Gender, 1: Region, 2: AI Survey, 3: Thinking/Gen, 4: Slot Machine, 5: Result
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('userProfile');
    return saved ? JSON.parse(saved) : { gender: null, region: null, history: {} };
  });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [isAILoading, setIsAILoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [foods, setFoods] = useState<Food[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  
  const controls = useAnimation(); // Framer motion controls for the slot machine reel

  useEffect(() => {
    localStorage.setItem('userProfile', JSON.stringify(profile));
  }, [profile]);

  // --- Core Handlers ---
  const handleGenderSelect = (gender: 'male' | 'female') => {
    setProfile({ gender, region: null, history: {} });
    setStep(1); // Go to Region Selection
  };

  const handleRegionSelect = async (regionName: string) => {
    setProfile(prev => ({ ...prev, region: regionName }));
    setStep(2);
    setIsAILoading(true);

    const promptTemplate = systemPrompts.generateSurvey.replace(/\${region}/g, regionName);

    try {
      const resp = await deepseek.post('/chat/completions', {
        model: 'deepseek-chat',
        messages: [{ role: 'system', content: promptTemplate }],
        response_format: { type: 'json_object' }
      });
      const parsed = JSON.parse(resp.data.choices[0].message.content);
      setQuestions(parsed.questions || []);
    } catch (err) {
      console.error('Survey generation error', err);
    } finally {
      setIsAILoading(false);
    }
  };

  const handleAnswer = (questionId: string, answer: string) => {
    const newHistory = { ...profile.history, [questionId]: answer };
    setProfile(prev => ({ ...prev, history: newHistory }));

    if (currentQuestionIdx < questions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
    } else {
      finalizeProfiling(newHistory);
    }
  };

  const finalizeProfiling = async (history: Record<string, string>) => {
    setStep(3);
    setIsAILoading(true);
    
    // Explicitly ask for 12 categories
    const context = `用户画像：性别 ${profile.gender}，地域/口味：${profile.region}，当前的身体情绪感知：${Object.values(history).join(', ')}。请给出最匹配的 12 个多元美食大类选项。一定要包含快餐汉堡等非常规餐饮选择。`;

    const promptTemplate = systemPrompts.generateCategories.replace(/\${region}/g, profile.region || '全国');

    try {
      const resp = await deepseek.post('/chat/completions', {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: promptTemplate },
          { role: 'user', content: context }
        ],
        response_format: { type: 'json_object' }
      });
      const parsed = JSON.parse(resp.data.choices[0].message.content);
      setCategories(parsed.categories || []);
      
      // Reset the slot animation
      controls.set({ y: 0 });
      setStep(4);
    } catch (err) {
      console.error('Category generation error', err);
    } finally {
      setIsAILoading(false);
    }
  };

  const startSpin = async () => {
    if (isSpinning || categories.length === 0) return;
    setIsSpinning(true);
    
    const randomIndex = Math.floor(Math.random() * categories.length);
    // Move to the 5th set of categories (so it scrolls a lot before stopping)
    const targetSetIndex = 5; 
    const finalOffset = -(targetSetIndex * categories.length + randomIndex) * SLOT_HEIGHT;

    await controls.start({
      y: finalOffset,
      transition: {
        duration: 4,
        ease: [0.15, 1, 0.3, 1] // Custom ease-out to simulate mechanical halting
      }
    });

    setIsSpinning(false);
    const chosen = categories[randomIndex];
    setSelectedCat(chosen);
    await generateFoods(chosen);
    setStep(5);
    confetti({
      particleCount: 150,
      spread: 90,
      origin: { y: 0.6 },
      colors: ['#f24e1e', '#ffcc00', '#ffffff']
    });
  };

  const generateFoods = async (cat: Category) => {
    setIsAILoading(true);
    const context = `用户画像：性别 ${profile.gender}，画像：${profile.region}，偏好：${Object.values(profile.history).join(', ')}。核心菜单：【${cat.name}】。`;
    const promptTemplate = systemPrompts.generateFoods.replace(/\${region}/g, profile.region || '全国');
    
    try {
      const resp = await deepseek.post('/chat/completions', {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: promptTemplate },
          { role: 'user', content: context }
        ],
        response_format: { type: 'json_object' }
      });
      const parsed = JSON.parse(resp.data.choices[0].message.content);
      setFoods(parsed.foods || []);
    } catch (err) {
      console.error('Food generation error', err);
    } finally {
      setIsAILoading(false);
    }
  };

  const reset = () => {
    setStep(0);
    setCurrentQuestionIdx(0);
    setCategories([]);
    setSelectedCat(null);
    setFoods([]);
    controls.set({ y: 0 });
    setProfile({ gender: null, region: null, history: {} });
  };

  // Build the repeated list for the slot machine (e.g. 7 repeated sets of categories)
  const slotReelItems = categories.length > 0 ? Array(7).fill(categories).flat() : [];

  return (
    <div className="container">
      <AnimatePresence mode="wait">
        {step === 0 && ( /* same as before */
          <motion.div key="step0" className="step-container" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, y: -20 }}>
            {/* ... */}
            <div className="header-simple">
              <motion.div initial={{ rotate: -10 }} animate={{ rotate: 10 }} transition={{ repeat: Infinity, duration: 3, repeatType: 'reverse' }}>
                <Utensils size={60} color="#f24e1e" />
              </motion.div>
              <h1>灵感风暴 · 吃点什么</h1>
              <p>打破选择僵局，解决终极难题。从汉堡披萨到日料沙拉，万物皆可盘。</p>
            </div>
            <div className="gender-row">
              <button className="gender-card male" onClick={() => handleGenderSelect('male')}>
                <span className="emoji">🍔</span>
                <h3>大胃少年</h3>
              </button>
              <button className="gender-card female" onClick={() => handleGenderSelect('female')}>
                <span className="emoji">🍣</span>
                <h3>挑剔少女</h3>
              </button>
            </div>
          </motion.div>
        )}

        {step === 1 && ( /* same as before */
          <motion.div key="step1" className="step-container" initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }}>
             <button className="back-btn" onClick={() => setStep(0)}>
               <ChevronLeft size={20} /> 返回重置
             </button>
             <div className="header-simple" style={{ marginTop: '2rem' }}>
               <MapPin size={50} color="#ffcc00" style={{ margin: '0 auto 1rem' }} />
               <h2>口味定调，由你定义</h2>
               <p>请选择您最亲切的地域胃口定位，或者当前最想体验的风味：</p>
             </div>
             
             <div className="region-grid">
               {REGIONS.map(reg => (
                 <button key={reg.id} className="region-card" onClick={() => handleRegionSelect(reg.name)}>
                    <span className="emoji-reg">{reg.icon}</span>
                    <div className="reg-info">
                      <h3>{reg.name}</h3>
                      <p>{reg.desc}</p>
                    </div>
                 </button>
               ))}
             </div>
          </motion.div>
        )}

        {step === 2 && ( /* same as before */
          <motion.div key="step2" className="step-container profiling-step" initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }}>
            {isAILoading ? (
              <div className="loading-state">
                 <div className="brain-animation">
                    <div className="circle one"></div>
                    <div className="circle two"></div>
                    <div className="circle three"></div>
                 </div>
                <p>正在分析您的 <b>{profile.region}</b> 胃口特征，生成专属深度问卷...</p>
              </div>
            ) : questions[currentQuestionIdx] && (
              <div className="question-card">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${((currentQuestionIdx+1)/questions.length)*100}%` }}></div>
                </div>
                <span className="q-badge">Decision Point {currentQuestionIdx+1}/{questions.length}</span>
                <h2>{questions[currentQuestionIdx].title}</h2>
                <div className="options-grid">
                  {questions[currentQuestionIdx].options.map(opt => (
                    <button key={opt.id} onClick={() => handleAnswer(questions[currentQuestionIdx].id, opt.label)} className="option-btn">
                       <span className="label-text">{opt.label}</span>
                       <span className="desc-text">{opt.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {step === 3 && ( /* same as before */
          <motion.div key="step3" className="step-container">
            <div className="loading-fullscreen">
               <div className="brain-animation">
                  <div className="circle one"></div>
                  <div className="circle two"></div>
                  <div className="circle three"></div>
               </div>
               <h2>AI 正在推算专列老虎机...</h2>
               <p style={{ color: '#888', marginTop: '1rem', fontStyle: 'italic' }}>“汇聚12个精准匹配美食爆点...”</p>
            </div>
          </motion.div>
        )}

        {/* STEP 4: SLOT MACHINE (NEW) */}
        {step === 4 && (
          <motion.div key="step4" className="step-container slot-step" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
             <div className="header-simple">
               <h2>终极抉择机 (12 种可能)</h2>
               <p>囊括中西快餐、特色地域菜系与灵魂小吃，一键定乾坤！</p>
             </div>
             
             <div className="slot-machine-wrapper">
                <div className="slot-selector-arrow left"></div>
                <div className="slot-window">
                  <motion.div 
                    className="slot-reel" 
                    animate={controls}
                    initial={{ y: 0 }}
                  >
                    {slotReelItems.map((cat, idx) => (
                      <div 
                        key={idx} 
                        className="slot-item"
                        style={{ backgroundColor: `${cat.color}20`, borderLeft: `8px solid ${cat.color}` }}
                      >
                        <span className="slot-item-name">{cat.name}</span>
                        <span className="slot-item-desc">{cat.description?.substring(0, 15)}...</span>
                      </div>
                    ))}
                  </motion.div>
                </div>
                <div className="slot-selector-arrow right"></div>
             </div>
             
             <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'center' }}>
               <button className="spin-sloth-btn lg" onClick={startSpin} disabled={isSpinning}>
                 {isSpinning ? (
                   <><Loader2 className="animate-spin" size={24} style={{ marginRight: '8px' }}/> 疯狂滚动中...</>
                 ) : (
                   <><Zap size={24} style={{ marginRight: '8px' }}/> 摇动拉杆！(SPIN)</>
                 )}
               </button>
             </div>
          </motion.div>
        )}

        {/* STEP 5: RESULT */}
        {step === 5 && selectedCat && (
          <motion.div key="step5" className="step-container result-step" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="category-header">
               <div className="cat-badge" style={{ backgroundColor: selectedCat.color }}>
                 <Award size={40} />
               </div>
               <div className="cat-info">
                 <h2>命中大奖：{selectedCat.name}</h2>
                 <p>{selectedCat.description}</p>
               </div>
            </div>

            <div className="food-details-list">
              {isAILoading ? (
                <div className="loading-state-mini">
                  <Loader2 className="animate-spin" size={30} />
                  <span>正在为您筛选最佳的具体外卖/餐厅建议...</span>
                </div>
              ) : (
                foods.map((food, idx) => (
                  <motion.div key={idx} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} className="detailed-food-card">
                    <div className="food-info">
                      <div className="food-card-top">
                        <h3>{food.name}</h3>
                        <div className="tags">
                          {food.tags.map(t => <span key={t} className="tag">#{t}</span>)}
                        </div>
                      </div>
                      <p>{food.description}</p>
                    </div>
                    <Star className="star-icon" size={30} />
                  </motion.div>
                ))
              )}
            </div>

            <div className="result-actions">
               <button className="retry-btn" onClick={() => {
                   controls.set({ y: 0 }); // reset the slot position immediately
                   setStep(4);
                 }}>
                  <RefreshCw size={18} /> 命中不符？重拨老虎机
               </button>
               <button className="reset-btn" onClick={reset}>归零重构，更换主基调</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
