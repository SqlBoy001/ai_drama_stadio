<template>
  <div class="director-page">
    <header><router-link to="/create" class="logo">Drama Stadio<span>把灵感拍成故事</span></router-link><nav aria-label="主导航"><router-link to="/projects">我的作品</router-link><router-link to="/agent-workbench">制作工作台</router-link><router-link to="/ai-config">模型设置</router-link></nav></header>
    <main>
      <p class="eyebrow">你的第一部 AI 短片</p>
      <h1>你讲一个想法，<br>我们一起把它拍出来。</h1>
      <p class="intro">不用懂分镜，也不用写提示词。先做一集短片，确认方向，再开始制作。</p>
      <ol class="steps" aria-label="创作步骤"><li :class="{ current: !session }">1 说想法</li><li :class="{ current: session && !session.plan }">2 定方向</li><li :class="{ current: session?.plan }">3 看方案</li></ol>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <section v-if="!session" class="card">
        <label for="idea">想拍什么故事？</label>
        <textarea id="idea" v-model="idea" maxlength="2000" rows="4" placeholder="例如：一个胆小的女孩，发现电梯里多了一个不存在的楼层。" />
        <div class="examples"><button v-for="example in examples" :key="example" @click="idea = example">{{ example }}</button></div>
        <div class="actions"><span>默认零费用演练，先熟悉流程</span><button class="primary" :disabled="busy || !idea.trim()" @click="create">{{ busy ? '保存中…' : '帮我完善这个想法 →' }}</button></div>
      </section>
      <section v-else-if="!session.plan" class="card">
        <div class="card-heading"><h2>先确定几个小方向</h2><button class="text" :disabled="busy" @click="reset">换个故事</button></div>
        <label for="brief-idea">你的故事</label><textarea id="brief-idea" v-model="brief.instruction" rows="3" maxlength="2000" :disabled="busy" />
        <fieldset v-for="question in questions" :key="question.key" :disabled="busy"><legend>{{ question.title }}</legend><div class="choices"><label v-for="option in question.options" :key="option" :class="{ selected: brief[question.key] === option }"><input type="radio" :name="question.key" :value="option" v-model="brief[question.key]">{{ option }}</label></div></fieldset>
        <label for="notes">还有什么特别想要或不想要的？<small>选填，修改意见会进入策划与剧本</small></label><textarea id="notes" v-model="brief.notes" maxlength="1000" rows="2" placeholder="例如：不要血腥，女主穿黄色外套，最后让人会心一笑。" :disabled="busy" />
        <details><summary>时长、预算与真实生成</summary><div class="settings">
          <label>时长<select v-model.number="brief.episode_duration_seconds" :disabled="busy"><option :value="30">30 秒（推荐）</option><option :value="45">45 秒</option><option :value="60">60 秒</option></select></label>
          <label>媒体预算上限（元）<input v-model.number="brief.budget_limit" type="number" min="10" max="500" :disabled="busy"></label>
          <label class="mode"><input type="checkbox" v-model="realMode" :disabled="busy">使用已配置的真实模型</label>
        </div><p class="notice">真实模式：下一步会调用一次文本模型策划（单独计费），确认方案后才开始生产。预算为媒体参考上限，不是供应商账单保证。</p><p v-if="realMode && !textReady" class="error">请先在模型设置中启用文本模型。也可关闭真实模式继续演练。</p></details>
        <div v-if="session.status === 'PLANNING'" class="notice" role="status">导演正在策划，草稿已保存。<button @click="reload" :disabled="busy">刷新进度</button></div>
        <div class="actions"><button class="secondary" :disabled="busy || session.status === 'PLANNING' || (realMode && !textReady)" @click="makePlan(true)">你帮我决定</button><button class="primary" :disabled="busy || session.status === 'PLANNING' || (realMode && !textReady)" @click="makePlan(false)">{{ busy ? '正在策划，请稍等…' : (realMode ? '调用文本模型，生成方案' : '生成演练方案 →') }}</button></div>
      </section>
      <section v-else class="card">
        <div class="card-heading"><span class="badge">{{ session.brief.dry_run ? '演练示例 · 未调用模型' : 'AI 导演方案' }}</span><button class="text" :disabled="busy || !!session.run_id" @click="edit">调整想法</button></div>
        <h2>{{ session.plan.project.title }}</h2><p class="story">{{ session.plan.director.story.logline }}</p>
        <dl><div><dt>画面</dt><dd>{{ session.brief.visual_style }}</dd></div><div><dt>时长</dt><dd>1 集 · {{ session.brief.episode_duration_seconds }} 秒</dd></div><div><dt>生产费用参考</dt><dd>{{ session.brief.dry_run ? '演练 ¥0' : `约 ¥${session.plan.estimated.estimated_cost}` }}</dd></div></dl>
        <h3>故事会这样展开</h3><ol class="beats"><li v-for="(beat, i) in session.plan.director.story.beats" :key="i">{{ beat }}</li></ol>
        <h3>主角与视觉设定</h3><p v-for="character in session.plan.characters" :key="character.temporary_id"><b>{{ character.name }}</b> · {{ character.visual_anchor }}</p>
        <p class="notice">{{ session.brief.dry_run ? '演练只验证流程，不会生成可播放视频，也不会产生模型费用。' : '确认后先生成剧本；剧本、视觉资产与最终镜头会分别等待你的审核。画面与剧情质量仍需你确认。' }}</p>
        <p v-if="session.plan.budget_warning" class="error">参考费用超过预算，请调整时长或预算后重新策划。</p>
        <div class="actions"><span>方案已保存，刷新后可继续</span><button class="primary" :disabled="busy || session.plan.budget_warning" @click="start">{{ busy ? '正在处理…' : session.run_id ? '继续这部作品 →' : session.brief.dry_run ? '确认，体验制作流程 →' : '确认方案，开始制作 →' }}</button></div>
      </section>
      <footer>先把故事讲清楚，再让模型完成制作。<router-link to="/projects">已有作品？进入项目库</router-link></footer>
    </main>
  </div>
</template>
<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { directorAPI } from '@/api/director'
import { agentAPI } from '@/api/agent'
const router = useRouter()
const idea = ref(''), session = ref(null), busy = ref(false), error = ref(''), providers = ref(null)
const brief = reactive({})
const examples = ['女孩走进了不存在的电梯楼层', '社恐插画师帮邻居寻找一只猫', '打工人获得一次重来今天的机会']
const questions = ref([])
const storageKey = 'drama-director-draft'
const realMode = computed({ get: () => brief.dry_run === false, set: value => { brief.dry_run = !value } })
const textReady = computed(() => providers.value?.capabilities?.some(v => v.service_type === 'text' && v.configured))
function accept(value) { session.value = value; Object.assign(brief, value.brief); questions.value = value.questions.length ? value.questions : value.question_catalog; localStorage.setItem(storageKey, value.id) }
async function act(fn) { if (busy.value) return; busy.value = true; error.value = ''; try { await fn() } catch (e) { error.value = e.message || '操作未完成，请重试' } finally { busy.value = false } }
function create() { return act(async () => accept(await directorAPI.create({ instruction: idea.value, dry_run: true }))) }
function reset() { session.value = null; questions.value = []; error.value = ''; localStorage.removeItem(storageKey) }
function reload() { return act(async () => accept(await directorAPI.get(session.value.id))) }
function makePlan(useDefaults) { return act(async () => { accept(await directorAPI.update(session.value.id, { ...brief, use_defaults: useDefaults })); accept(await directorAPI.plan(session.value.id)) }) }
function edit() { return act(async () => accept(await directorAPI.update(session.value.id, {}))) }
function start() { return act(async () => { const run = await directorAPI.start(session.value.id, session.value.revision); await router.push({ path: '/agent-workbench', query: { run: run.id } }) }) }
onMounted(async () => {
  try { providers.value = await agentAPI.providerStatus() } catch (_) { /* Mock remains available without provider status. */ }
  const id = localStorage.getItem(storageKey)
  if (id) await act(async () => { try { accept(await directorAPI.get(id)) } catch (e) { if (e.response?.status === 404) localStorage.removeItem(storageKey); throw e } })
})
</script>
<style scoped>
.director-page{min-height:100vh;background:#f7f7f2;color:#202a29;font-family:inherit}header{max-width:1120px;margin:auto;padding:24px 32px;display:flex;justify-content:space-between;align-items:center;gap:20px}a{color:inherit;text-decoration:none}.logo{font-size:20px;font-weight:750}.logo span{display:block;font-size:11px;font-weight:400;color:#61726b;margin-top:5px}nav{display:flex;gap:22px;font-size:14px}main{max-width:850px;margin:36px auto 0;padding:0 24px 40px}.eyebrow{font-size:13px;color:#356754;letter-spacing:2px}h1{font-size:46px;line-height:1.25;letter-spacing:-1.5px;margin:14px 0 18px}h2{font-size:24px;margin:12px 0}h3{font-size:16px;margin-top:24px}.intro{color:#596b65;line-height:1.8}.steps{display:flex;gap:28px;list-style:none;padding:20px 0;color:#64716b;font-size:14px}.steps .current{color:#155b43;font-weight:750}.card{background:white;border:1px solid #dfe6de;box-shadow:0 12px 36px #163f2610;border-radius:18px;padding:30px}.card-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}label,legend{font-size:15px;font-weight:600}textarea,input[type=number],select{display:block;width:100%;border:1px solid #b8c7bc;border-radius:10px;padding:12px 14px;margin:12px 0 18px;font:inherit;background:#fbfcf9;color:#202a29}textarea{resize:vertical;line-height:1.8}textarea:focus,input:focus,select:focus,button:focus-visible,a:focus-visible{outline:3px solid #99cfb8;outline-offset:2px}button{font:inherit;cursor:pointer;border:1px solid #b8c7bc;border-radius:9px;padding:10px 14px;background:white;color:#24533e}button:disabled{opacity:.55;cursor:not-allowed}.primary{background:#185c43;color:white;border-color:#185c43;padding:13px 20px;font-weight:650}.secondary{background:#f0f5ec}.text{border:0;background:none}.examples{display:flex;flex-wrap:wrap;gap:8px}.examples button{font-size:12px;background:#f4f7f0}.actions{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:24px}.actions span,small{font-size:12px;color:#596b65}small{display:block;margin-top:6px}fieldset{border:0;margin:24px 0;padding:0}.choices{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}.choices label{font-size:14px;font-weight:400;border:1px solid #d4ded3;border-radius:9px;padding:10px 12px;cursor:pointer}.choices input{accent-color:#185c43;margin-right:6px}.choices .selected{background:#eaf4ec;border-color:#367a58}details{margin-top:20px}summary{cursor:pointer;font-size:14px;color:#356754}.settings{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px}.mode{grid-column:1/-1}.notice{font-size:13px;color:#536658;line-height:1.8;background:#f2f6ee;border-radius:10px;padding:12px}.error{color:#9a3024;background:#fff0ec;border:1px solid #eac2b7;padding:12px;border-radius:10px;line-height:1.6}.badge{font-size:12px;padding:6px 9px;border-radius:6px;background:#eaf4ec;color:#21553a}.story{line-height:1.8}dl{display:flex;gap:32px;background:#f7f9f5;padding:18px;border-radius:10px}dt{font-size:12px;color:#596b65}dd{margin:8px 0 0;font-size:14px;font-weight:650}.beats{padding-left:22px;line-height:1.8}.beats li{padding:8px 0}footer{font-size:12px;line-height:1.8;color:#596b65;margin:25px 0}footer a{display:block;color:#185c43;margin-top:8px}@media(max-width:600px){header{padding:18px;align-items:flex-start}nav{gap:10px;font-size:12px;flex-wrap:wrap;justify-content:flex-end}.logo{font-size:16px;min-width:116px}main{margin-top:18px;padding:0 16px 24px}h1{font-size:34px}.card{padding:20px}.steps{gap:20px}.actions{align-items:stretch;flex-direction:column}.actions button{width:100%}.settings{grid-template-columns:1fr}dl{gap:16px;flex-wrap:wrap}}
</style>
