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
  // 定义引导性问题和选项
  generateSurvey: `作为高级美食行为心理学家，请输出一套针对当代中国年轻人吃什么选择困难症的调查问卷。
已知条件：
- 用户地域属性：\${region}
- 当前就餐场景：\${mealTime}
要求：
1. 请根据以上的就餐场景（如如果选了早餐，就问豆浆油条还是面包咖啡；如果选了夜宵，就问要烧烤还是小龙虾），包含 3 个维度的提问。
2. 每个问题提供3-4个极具诱惑力且带点网感或直接的选项描述。
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

  // 基于画像生成 12 大类分类 - 丰富转盘
  generateCategories: `基于用户的性别、地域（\${region}）、就餐场景（\${mealTime}）以及问卷结果，推断出 12 个丰富、截然不同美食大类（即外卖平台上的顶级分类，如：盖浇饭、麻辣烫、汉堡快餐、面包烘焙、奶茶果汁、烧烤烤肉等）。
要求：
1. 必须强烈符合当前的就餐场景 \${mealTime}！比如如果是下午茶，就得全是甜品、炸鸡、奶茶；如果是夜宵，就得涵盖烧烤、小海鲜、冒菜等。
2. 分类名称要简练但富有感染力（如：粗暴美式汉堡、川香麻辣拌、深夜居酒屋等）。
3. 输出格式为JSON：
{
  "categories": [
    {"id": "c1", "name": "外卖分类名", "color": "HEX颜色", "description": "一段吸引人的描述"}
  ] // 必须严格输出 12 个分类
}`,

  // 生成具体菜品
  generateFoods: `根据选定的分类（如：粗暴美式汉堡），结合用户的画像与就餐场景（\${mealTime}），生成 3-4 个具体的美食推荐，并搭配一段令人垂涎欲滴的描述。
要求：
不要说空话，直接报菜名！直接模仿外卖平台上的爆款单品。
输出格式：
{
  "foods": [
    {"id": "f1", "name": "绝赞单品菜名", "description": "诱人且极其生动的描述", "tags": ["标签", "口感"]}
  ]
}`
};
