import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  { id: 'canton', name: '两广福建仔', desc: '早茶点心、原汁原味、靓汤海鲜', icon: '🥟' }
];

const App: React.FC = () => {
  const [step, setStep] = useState(0); // 0: Gender, 1: Region, 2: AI Survey, 3: Thinking/Wheel Gen, 4: Roulette, 5: Result
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
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);

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
    
    const context = `用户画像：性别 ${profile.gender}，地域背景：${profile.region}，其他偏向：${Object.values(history).join(', ')}。请严格基于【中国本土饮食文化】及该用户的【地域特征】推断出对应的 6 个美食大类。注意：地域特征为主，但偶尔推一点跨地域的新鲜感也是可以的。`;

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
      setStep(4);
    } catch (err) {
      console.error('Category generation error', err);
    } finally {
      setIsAILoading(false);
    }
  };

  const startSpin = () => {
    if (isSpinning || categories.length === 0) return;
    setIsSpinning(true);
    
    const randomIndex = Math.floor(Math.random() * categories.length);
    const degreePerSection = 360 / categories.length;
    const targetRotation = 360 * 10 + (randomIndex * degreePerSection) + (degreePerSection / 2);
    
    setRotation(prev => prev + targetRotation);

    setTimeout(async () => {
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
    }, 4000);
  };

  const generateFoods = async (cat: Category) => {
    setIsAILoading(true);
    const context = `用户画像：性别 ${profile.gender}，地域：${profile.region}，偏好：${Object.values(profile.history).join(', ')}。选定中国美食分类：【${cat.name}】。`;
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
    setRotation(0);
    setProfile({ gender: null, region: null, history: {} });
  };

  // --- Components ---
  const currentQuestion = questions[currentQuestionIdx];

  return (
    <div className="container">
      <AnimatePresence mode="wait">
        {/* STEP 0: GENDER SELECTION */}
        {step === 0 && (
          <motion.div key="step0" className="step-container" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, y: -20 }}>
            <div className="header-simple">
              <motion.div initial={{ rotate: -10 }} animate={{ rotate: 10 }} transition={{ repeat: Infinity, duration: 3, repeatType: 'reverse' }}>
                <Utensils size={60} color="#f24e1e" />
              </motion.div>
              <h1>寻味中国 · 灵感决定</h1>
              <p>基于中国美食文化的 AI 决策引擎。每一碗烟火气，都值得被精准推荐。</p>
            </div>
            <div className="gender-row">
              <button className="gender-card male" onClick={() => handleGenderSelect('male')}>
                <span className="emoji">🥢</span>
                <h3>大胃少年</h3>
              </button>
              <button className="gender-card female" onClick={() => handleGenderSelect('female')}>
                <span className="emoji">🥟</span>
                <h3>饕餮少女</h3>
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 1: REGION SELECTION */}
        {step === 1 && (
          <motion.div key="step1" className="step-container" initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }}>
             <button className="back-btn" onClick={() => setStep(0)}>
               <ChevronLeft size={20} /> 返回重选性别
             </button>
             <div className="header-simple" style={{ marginTop: '2rem' }}>
               <MapPin size={50} color="#ffcc00" style={{ margin: '0 auto 1rem' }} />
               <h2>南北之争，由你定义</h2>
               <p>饮食特征差异极大，请选择您最亲切的地域胃口定位，或者当前最想体验的风味：</p>
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

        {/* STEP 2: AI SURVEY */}
        {step === 2 && (
          <motion.div key="step2" className="step-container profiling-step" initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }}>
            {isAILoading ? (
              <div className="loading-state">
                 <div className="brain-animation">
                    <div className="circle one"></div>
                    <div className="circle two"></div>
                    <div className="circle three"></div>
                 </div>
                <p>正在分析您的 <b>{profile.region}</b> 胃口特征，生成专属美食问卷...</p>
              </div>
            ) : currentQuestion && (
              <div className="question-card">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${((currentQuestionIdx+1)/questions.length)*100}%` }}></div>
                </div>
                <span className="q-badge">Decision Point {currentQuestionIdx+1}/{questions.length}</span>
                <h2>{currentQuestion.title}</h2>
                <div className="options-grid">
                  {currentQuestion.options.map(opt => (
                    <button key={opt.id} onClick={() => handleAnswer(currentQuestion.id, opt.label)} className="option-btn">
                       <span className="label-text">{opt.label}</span>
                       <span className="desc-text">{opt.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* STEP 3: ANALYZING */}
        {step === 3 && (
          <motion.div key="step3" className="step-container">
            <div className="loading-fullscreen">
               <div className="brain-animation">
                  <div className="circle one"></div>
                  <div className="circle two"></div>
                  <div className="circle three"></div>
               </div>
               <h2>AI 正在揉合您的画像...</h2>
               <p>性别: {profile.gender === 'male' ? '男生' : '女生'} | 地域: {profile.region}</p>
               <p style={{ color: '#888', marginTop: '1rem', fontStyle: 'italic' }}>“汇聚八大菜系与街头巷尾的灵感...”</p>
            </div>
          </motion.div>
        )}

        {/* STEP 4: ROULETTE */}
        {step === 4 && (
          <motion.div key="step4" className="step-container roulette-step" initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
             <div className="header-simple">
               <h2>灵感转盘已就绪</h2>
               <p>AI 已根据您的深层需求推断出最好的一餐</p>
             </div>
             <div className="wheel-wrapper">
                <div className="wheel-pointer"></div>
                <div className="wheel" style={{ transform: `rotate(${rotation}deg)`, transition: isSpinning ? 'transform 4s cubic-bezier(0.15, 0, 0.15, 1)' : 'none' }}>
                  {categories.map((cat, i) => (
                    <div key={cat.id} className="wheel-section" style={{ transform: `rotate(${(360/categories.length) * i}deg)`, backgroundColor: cat.color, clipPath: 'polygon(50% 50%, 0 0, 100% 0)' }}>
                      <span className="wheel-label">{cat.name}</span>
                    </div>
                  ))}
                </div>
                <button className="wheel-center-btn" onClick={startSpin} disabled={isSpinning}>
                  {isSpinning ? 'SPIN' : '指 引'}
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
                 <h2>今日上选：{selectedCat.name}</h2>
                 <p>{selectedCat.description}</p>
               </div>
            </div>

            <div className="food-details-list">
              {isAILoading ? (
                <div className="loading-state-mini">
                  <Loader2 className="animate-spin" size={30} />
                  <span>正在为您筛选 <b>{profile.region}</b> 最地道的必吃选择...</span>
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
               <button className="retry-btn" onClick={() => setStep(4)}>
                  <RefreshCw size={18} /> 命中不符？重拨灵感
               </button>
               <button className="reset-btn" onClick={reset}>归零，重新定义画像</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
