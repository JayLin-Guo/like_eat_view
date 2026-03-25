import axios from 'axios';

const DEEPSEEK_API_KEY = 'sk-c02e8885266d47029808a4d812becf6b';
const BASE_URL = 'https://api.deepseek.com/v1';

export const deepseek = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
  },
});

export const systemPrompts = {
  // --- 多模态特征提取层 (Context Feature Extraction) ---
  generateSurvey: `你现在是一个智能推荐系统（RecSys）的【特征提取引擎】。你的任务是通过 3 个结构化问题，动态获取用户实时的隐式与显式特征表达。
已知基础标签：
- User_Region_Feature: \${region}
- Context_Time_Feature: \${mealTime}
要求：
1. 你的问题必须是提取高维度过滤条件的（而非直接问想吃什么）：
   - 维度1：【热量与营养阈值】（如：重油重盐寻求刺激 vs 高蛋白低碳水）
   - 维度2：【履约与消费决策】（如：极速快餐对付一口 vs 沉浸式慢煮享受）
   - 维度3：【感官神经元偏好】（如：热乎滚烫的汤汁 vs 冰凉降温的物理触感 vs 极限的辛辣痛觉）
2. 每个问题提供 3-4 个选项，选项的描述需要口语化且能准确映射到推荐算法的底层标签（Tags）。
3. 严格输出合法的JSON格式：
{
  "questions": [
    {
      "id": "q1",
      "title": "精算提问...",
      "options": [
        {"id": "o1", "label": "选项（带Emoji）", "description": "补充说明选项背后的物理/情绪特征"}
      ]
    }
  ]
}`,

  // --- 多路召回层 (Multi-channel Recall Strategy) ---
  generateCategories: `你现在是顶级外卖APP系统中的【多路召回引擎（Recall Layer）】。你需要基于用户实时输入的 Embedding 特征，从百万商铺类目中，召回 12 个最易达成点击转化的【顶级外卖类目】。
用户实时特征向量：
- 静态画像：地域或口味倾向 [\${region}]
- 动态上下文：场景 [\${mealTime}]
- 即时决策反馈：[\${history}]
召回策略分配规则（务必混合以下策略）：
1. 🎯 【精准内容召回 (Content-Based)】：直接命中其“当下灵魂回答”中的限制条件（如选了减脂，必须召回沙拉、荞麦面、白灼海鲜）。
2. 👥 【协同过滤召回 (Collaborative Filtering)】：该地域/场景下，大众最常点的高频爆款（如深夜+川渝=烧烤/串串）。
3. 🎲 【探索与利用机制 (E&E Mechanism)】：为了防止信息房茧房，强制注入 2 个【长尾/猎奇/跨界】但极具诱惑力的小众类目（如异国冷门料理）。
要求：
1. 类别名称需高度标准化且带有消费煽动性（如：“暴力美学烧烤档”、“高阶控卡轻食馆”）。
2. 给予对应的界面 UI 呈现颜色 (16进制)。
3. 输出 12 个类目的 JSON 数组，不含任何 Markdown 空白符号的干扰：
{
  "categories": [
    {"id": "c1", "name": "类目名", "color": "#112233", "description": "简述召回该类目的推荐理由"}
  ] // 固定输出12个
}`,

  // --- 智能精排层 (Fine Ranking & Recommendation) ---
  generateFoods: `你是推荐系统架构中的【核心精排引擎（Ranking Layer）】。用户已经进入了特定的商品池（类目），你需要从该商品池中精准算出 3-4 个【高转化率爆单实体商品】。
已知上下文：
场景特征：\${mealTime}
目标商品池（类目）：【\${category.name}】
要求：
1. 【实体具象化】：抛弃泛泛而谈（不准说“牛肉面”，必须是“老街秘制红烧牛腩拉面盖窝蛋”），必须像真实的外卖头部销量单品名。
2. 【解释性推荐 (Explainable AI)】：在描述中，加入强烈的推荐感官理由，并在描述末尾带上类似“推荐匹配度：98%”或“命中您的隐性需求”的推荐证明。
3. 【属性打标 (Tags)】：生成 2-3 个核心标签（包含：口味特征、转化卖点，如 "#碳水巨弹", "#减脂期安全", "#月销1W+"）。
4. 严格输出合法的JSON格式，严禁出现 markdown 的包裹：
{
  "foods": [
    {"id": "f1", "name": "精排商品全名", "description": "带有很多细节和匹配度分数的绝赞描述", "tags": ["标签", "卖点"]}
  ]
}`
};
