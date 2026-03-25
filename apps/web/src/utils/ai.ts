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
  // 定义引导性问题和选项 - 锁定中国本土美食语境，并且考虑到用户的地域特征
  generateSurvey: `作为中国本土美食行为专家，请输出一套针对中国用户口味偏好的调查问卷。
已知该用户的地域背景是：\${region}。请务必结合该地域的传统饮食习惯和刻板印象（但也允许反差）来设计问题。
要求：
1. 包含3-4个维度：
   - 味觉基准（结合地域，例如如果是四川，问辣度接受上限；如果是江浙沪，问甜度容忍度）
   - 饮食场景（如：街边苍蝇馆子、精致商超餐饮、深夜路边摊）
   - 当前身体或情绪信号（如：压力大需要重油、清淡养生）
2. 每个问题提供3-4个极具诱惑力且地域感明显的选项。
3. 输出格式为JSON：
{
  "questions": [
    {
      "id": "q1",
      "title": "问题标题",
      "options": [
        {"id": "o1", "label": "选项标签", "description": "补充描述"}
      ]
    }
  ]
}`,

  // 基于画像生成大类分类
  generateCategories: `基于用户的性别、地域背景（\${region}）以及问卷结果，推断出用户当前最可能感兴趣的 6 个中国美食大类。
要求：
1. 充分考虑地域特色，但也不要完全局限（比如北方人也可能突然想吃精致粤菜）。
2. 分类名称要富有文学色彩或极具吸引力（如：川香热辣派对、江南烟雨咸甜、老陕碳水之魂、大排档烟火气、沉浸式嗦粉等）。
3. 只针对中国本土餐饮。
4. 输出格式为JSON：
{
  "categories": [
    {"id": "c1", "name": "分类名", "color": "HEX颜色", "description": "一段吸引人的描述"}
  ]
}`,

  // 生成具体菜品
  generateFoods: `根据选定的分类（如：川香热辣派对），结合用户的地域（\${region}）和画像，生成 3-4 个具体属于该类别的中国美食，并搭配一段令人垂涎欲滴的中文描述。
输出格式：
{
  "foods": [
    {"id": "f1", "name": "菜名", "description": "诱人描述", "tags": ["地域标签", "口感"]}
  ]
}`
};
