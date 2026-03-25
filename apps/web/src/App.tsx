import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { Utensils, RefreshCw, ChevronLeft, Award, User, Sparkles, Send, Loader2, Star, CheckCircle2, ChevronRight, Zap, MapPin, Clock, ArrowRight } from 'lucide-react';
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
  mealTime: string | null;
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
  { id: 'north', name: '北方豪放派', desc: '面食大盘鸡、牛羊硬菜', icon: '🍜' },
  { id: 'south', name: '江南婉约派', desc: '精致苏浙、清淡鲜甜', icon: '🍚' },
  { id: 'spicy', name: '川渝湘辣鬼', desc: '无辣不欢、重油爆炒', icon: '🌶️' },
  { id: 'northwest', name: '大西北狂野', desc: '烤肉串串、手抓羊肉', icon: '🍖' },
  { id: 'canton', name: '两广福建仔', desc: '早茶煲汤、原汁海鲜', icon: '🥟' },
  { id: 'fast', name: '现代快餐控', desc: '炸鸡披萨、百搭汉堡', icon: '🍔' }
];

const MEAL_TIMES = [
  { id: 'breakfast', name: '元气早餐', desc: '唤醒清晨的能量', icon: '🥐' },
  { id: 'lunch', name: '午餐饱腹', desc: '工作加餐/日常干饭', icon: '🍱' },
  { id: 'teatime', name: '下午茶歇', desc: '奶茶果汁、摸鱼甜品', icon: '🧋' },
  { id: 'dinner', name: '丰盛晚餐', desc: '疲惫解压/朋友聚餐', icon: '🍲' },
  { id: 'night', name: '深夜食堂', desc: '烧烤夜宵、罪恶快感', icon: '🍢' }
];

const SLOT_HEIGHT = 80;

const App: React.FC = () => {
  const [step, setStep] = useState(0); 
  // 0:Gender, 1:Region, 2:Meal, 3:AI Survey, 4:Loading Cats, 5:Slot, 6:Categories Grid, 7:Final Menu
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('userProfile');
    return saved ? JSON.parse(saved) : { gender: null, region: null, mealTime: null, history: {} };
  });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [isAILoading, setIsAILoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [foods, setFoods] = useState<Food[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  
  const controls = useAnimation();

  useEffect(() => {
    localStorage.setItem('userProfile', JSON.stringify(profile));
  }, [profile]);

  // --- Core Handlers ---
  const handleGenderSelect = (gender: 'male' | 'female') => {
    setProfile({ gender, region: null, mealTime: null, history: {} });
    setStep(1); 
  };

  const handleRegionSelect = (regionName: string) => {
    setProfile(prev => ({ ...prev, region: regionName }));
    setStep(2);
  };

  const handleMealTimeSelect = async (mealTimeName: string) => {
    setProfile(prev => ({ ...prev, mealTime: mealTimeName }));
    setStep(3);
    setIsAILoading(true);

    let promptTemplate = systemPrompts.generateSurvey
      .replace(/\${region}/g, profile.region || '全国')
      .replace(/\${mealTime}/g, mealTimeName);

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
    setStep(4);
    setIsAILoading(true);
    
    const context = `用户画像：性别 ${profile.gender}，地域/口味：${profile.region}。就餐场景：${profile.mealTime}。目前的情绪或偏向：${Object.values(history).join(', ')}。务必推断出 12 个强关联 ${profile.mealTime} 场景的顶级美食大类（即外卖最顶级的归类）。`;

    const promptTemplate = systemPrompts.generateCategories
      .replace(/\${region}/g, profile.region || '全国')
      .replace(/\${mealTime}/g, profile.mealTime || '日常');

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
      
      controls.set({ y: 0 });
      setStep(5);
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
    const targetSetIndex = 5; 
    const finalOffset = -(targetSetIndex * categories.length + randomIndex) * SLOT_HEIGHT;

    await controls.start({
      y: finalOffset,
      transition: { duration: 4, ease: [0.15, 1, 0.3, 1] }
    });

    setIsSpinning(false);
    const chosen = categories[randomIndex];
    setSelectedCat(chosen);
    setStep(6);
    confetti({
      particleCount: 200,
      spread: 120,
      origin: { y: 0.6 },
      colors: ['#f24e1e', '#ffcc00', '#ffffff']
    });
  };

  const handleEnterCategory = async (cat: Category) => {
    setSelectedCat(cat);
    setStep(7);
    setIsAILoading(true);
    
    const context = `用户 ${profile.gender}，画像：${profile.region}，场景：${profile.mealTime}。细节：${Object.values(profile.history).join(', ')}。用户已点击进入最顶级大类：【${cat.name}】。给出具体的商家爆款菜单。`;
    const promptTemplate = systemPrompts.generateFoods.replace(/\${mealTime}/g, profile.mealTime || '日常');
    
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
    setProfile({ gender: null, region: null, mealTime: null, history: {} });
  };

  const slotReelItems = categories.length > 0 ? Array(7).fill(categories).flat() : [];

  return (
    <div className="container">
      <AnimatePresence mode="wait">
        {/* STEP 0: GENDER SELECTION */}
        {step === 0 && ( /* same as before */
          <motion.div key="step0" className="step-container" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, y: -20 }}>
            <div className="header-simple">
              <motion.div initial={{ rotate: -10 }} animate={{ rotate: 10 }} transition={{ repeat: Infinity, duration: 3, repeatType: 'reverse' }}>
                <Utensils size={60} color="#f24e1e" />
              </motion.div>
              <h1>灵感风暴 · 吃点什么</h1>
              <p>打破选择僵局，解决终极难题。从汉堡披萨到日料沙拉，外卖平台级导流。</p>
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

        {/* STEP 1: REGION SELECTION */}
        {step === 1 && ( /* same as before */
          <motion.div key="step1" className="step-container" initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }}>
             <button className="back-btn" onClick={() => setStep(0)}>
               <ChevronLeft size={20} /> 返回重置
             </button>
             <div className="header-simple" style={{ marginTop: '2rem' }}>
               <MapPin size={50} color="#ffcc00" style={{ margin: '0 auto 1rem' }} />
               <h2>口味定调，由你定义</h2>
               <p>饮食特征差异极大，请选择您当前的深层基因与想吃流派：</p>
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

        {/* STEP 2: MEAL TIME SELECTION */}
        {step === 2 && ( /* same as before */
          <motion.div key="step2" className="step-container" initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }}>
             <button className="back-btn" onClick={() => setStep(1)}>
               <ChevronLeft size={20} /> 返回地域选择
             </button>
             <div className="header-simple" style={{ marginTop: '2rem' }}>
               <Clock size={50} color="#ffcc00" style={{ margin: '0 auto 1rem' }} />
               <h2>什么时段的饥饿？</h2>
               <p>这会决定 AI 构建顶级外卖分类池的方向和画风：</p>
             </div>
             
             <div className="region-grid">
               {MEAL_TIMES.map(meal => (
                 <button key={meal.id} className="region-card" onClick={() => handleMealTimeSelect(meal.name)}>
                    <span className="emoji-reg">{meal.icon}</span>
                    <div className="reg-info">
                      <h3>{meal.name}</h3>
                      <p>{meal.desc}</p>
                    </div>
                 </button>
               ))}
             </div>
          </motion.div>
        )}

        {/* STEP 3: AI SURVEY */}
        {step === 3 && ( /* same as before */
          <motion.div key="step3" className="step-container profiling-step" initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }}>
            {isAILoading ? (
              <div className="loading-state">
                 <div className="brain-animation">
                    <div className="circle one"></div>
                    <div className="circle two"></div>
                    <div className="circle three"></div>
                 </div>
                <p>正在拉取对应 <b>{profile.mealTime}</b> 的情绪快照问卷...</p>
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

        {/* STEP 4: ANALYZING CATEGORIES */}
        {step === 4 && ( /* same as before */
          <motion.div key="step4" className="step-container">
            <div className="loading-fullscreen">
               <div className="brain-animation">
                  <div className="circle one"></div>
                  <div className="circle two"></div>
                  <div className="circle three"></div>
               </div>
               <h2>拉取全网实时美食排档...</h2>
               <p style={{ color: '#888', marginTop: '1rem', fontStyle: 'italic' }}>“汇聚 {profile.mealTime} 的 12 个顶级外卖大分类...”</p>
            </div>
          </motion.div>
        )}

        {/* STEP 5: SLOT MACHINE FOR CATEGORIES */}
        {step === 5 && ( /* same as before */
          <motion.div key="step5" className="step-container slot-step" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
             <div className="header-simple">
               <h2>外卖归类抉择机 ({profile.mealTime} 专供)</h2>
               <p>12 大强关联场景的顶级分类池，不知道吃哪类？一键摇出大方向！</p>
             </div>
             
             <div className="slot-machine-wrapper">
                <div className="slot-selector-arrow left"></div>
                <div className="slot-window">
                  <motion.div className="slot-reel" animate={controls} initial={{ y: 0 }}>
                    {slotReelItems.map((cat, idx) => (
                      <div key={idx} className="slot-item" style={{ backgroundColor: `${cat.color}20`, borderLeft: `8px solid ${cat.color}` }}>
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
                   <><Loader2 className="animate-spin" size={24} style={{ marginRight: '8px' }}/> 锁定爆款类目中...</>
                 ) : (
                   <><Zap size={24} style={{ marginRight: '8px' }}/> 摇动拉杆！(SPIN)</>
                 )}
               </button>
             </div>
          </motion.div>
        )}

        {/* STEP 6: CATEGORIES DASHBOARD (NEW) */}
        {step === 6 && selectedCat && (
          <motion.div key="step6" className="step-container" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
            <div className="header-simple">
               <h2>您的专属品类区</h2>
               <p>抉择机已为您锁定主推项，您也可以挑选其他分类进入详单</p>
            </div>
            
            {/* Highlighted winner */}
            <div className="winning-category-card" onClick={() => handleEnterCategory(selectedCat)}>
                <div className="win-badge">命中首选</div>
                <div className="win-content">
                  <h2 style={{ color: selectedCat.color }}>{selectedCat.name}</h2>
                  <p>{selectedCat.description}</p>
                </div>
                <div className="win-action">
                   进入菜单选购 <ArrowRight size={20} />
                </div>
            </div>

            <h3 className="sub-title">或看看其他备选大类：</h3>
            <div className="compact-category-grid">
               {categories.filter(c => c.id !== selectedCat.id).map(cat => (
                 <motion.button 
                   whileHover={{ scale: 1.05 }}
                   whileTap={{ scale: 0.95 }}
                   key={cat.id} 
                   className="compact-cat-card" 
                   onClick={() => handleEnterCategory(cat)}
                 >
                   <div className="cat-color-bar" style={{ backgroundColor: cat.color }}></div>
                   <span className="cat-name">{cat.name}</span>
                 </motion.button>
               ))}
            </div>
            
            <div className="result-actions" style={{ marginTop: '4rem' }}>
              <button className="reset-btn" onClick={() => { controls.set({ y: 0 }); setStep(5); }}>
                  返回重新摇品类
               </button>
               <button className="reset-btn" onClick={reset}>归零重构整体画像</button>
            </div>
          </motion.div>
        )}

        {/* STEP 7: FINAL FOOD MENU */}
        {step === 7 && selectedCat && (
          <motion.div key="step7" className="step-container result-step" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <button className="back-btn" onClick={() => setStep(6)}>
               <ChevronLeft size={20} /> 返回大类选择
            </button>
            
            <div className="category-header">
               <div className="cat-badge" style={{ backgroundColor: selectedCat.color }}>
                 <Award size={40} />
               </div>
               <div className="cat-info">
                 <h2>{selectedCat.name} - 详细菜单</h2>
                 <p>{selectedCat.description}</p>
               </div>
            </div>

            <div className="food-details-list">
              {isAILoading ? (
                <div className="loading-state-mini">
                  <Loader2 className="animate-spin" size={30} />
                  <span>正在为您抓取该类目下的高分商铺/爆款单品...</span>
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
               <button className="retry-btn" onClick={() => handleEnterCategory(selectedCat)}>
                  <RefreshCw size={18} /> 菜单不满意？换一批单品
               </button>
               <button className="reset-btn" onClick={() => setStep(6)}>返回上一级 (切换其他品类)</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
