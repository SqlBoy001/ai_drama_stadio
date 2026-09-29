<template>
  <div class="workbench-shell">
    <header class="topbar">
      <button class="brand" @click="router.push('/projects')">
        <span class="brand-mark"><el-icon><VideoCameraFilled /></el-icon></span>
        <span><b>制作总控</b><small>审核 · 进度 · 成本</small></span>
      </button>
      <div class="topbar-center">
        <span class="live-dot"></span>
        {{ activeRun?.dry_run === false ? '真实 AI 生产' : '安全演练工作区' }}
        <span class="divider"></span>
        {{ activeRun ? activeRun.plan?.project?.title : '新创作' }}
      </div>
      <div class="topbar-actions">
        <el-button text @click="router.push('/projects')"><el-icon><House /></el-icon>项目库</el-button>
        <el-button text :aria-label="isDark ? '切换到亮色模式' : '切换到暗色模式'" @click="toggleTheme"><el-icon><Sunny v-if="isDark" /><Moon v-else /></el-icon></el-button>

      </div>
    </header>

    <aside class="sidebar">
      <nav>
        <button class="nav-item" :class="{ active: focusPanel === 'dashboard' }" @click="showPanel('dashboard')"><el-icon><MagicStick /></el-icon><span>总控台</span></button>
        <button class="nav-item" :class="{ active: focusPanel === 'approvals' }" @click="showPanel('approvals')"><el-icon><CircleCheck /></el-icon><span>审核中心</span><i v-if="pendingApproval" class="nav-badge">1</i></button>
        <button class="nav-item" :class="{ active: focusPanel === 'monitor' }" @click="showPanel('monitor')"><el-icon><DataLine /></el-icon><span>运行监控</span></button>
        <button class="nav-item" :class="{ active: focusPanel === 'cost' }" @click="showPanel('cost')"><el-icon><Wallet /></el-icon><span>成本控制</span></button>
      </nav>
      <div class="sidebar-section">
        <p>最近任务</p>
        <button v-for="run in runs.slice(0, 5)" :key="run.id" class="recent-run" :class="{ selected: activeRun?.id === run.id }" @click="selectRun(run.id)">
          <span class="recent-icon"><el-icon><Film /></el-icon></span>
          <span><b>{{ run.plan?.project?.title || '未命名短剧' }}</b><small>{{ statusLabel(run.status) }}</small></span>
        </button>
        <div v-if="!runs.length" class="empty-runs">首个创作会出现在这里</div>
      </div>
      <div class="safe-card" :class="{ real: activeRun?.dry_run === false }">
        <el-icon><MagicStick v-if="activeRun?.dry_run === false" /><Lock v-else /></el-icon>
        <div><b>{{ activeRun?.dry_run === false ? 'AI 托管生产中' : '安全演练' }}</b><small>{{ activeRun?.dry_run === false ? '正在调用你配置的真实模型，关键阶段会等待审核。' : '不会调用付费 API。' }}</small></div>
      </div>
    </aside>

    <main class="workspace">
      <section v-if="!activeRun" class="creation-view">
        <button v-if="runs.length" class="creation-close" aria-label="关闭新建创作并返回最近任务" @click="returnToRun"><el-icon><Close /></el-icon><span>返回任务</span></button>
        <div class="eyebrow"><span></span> AI DIRECTOR</div>
        <h1>把一个灵感，变成<br><em>可以开拍的短剧。</em></h1>
        <p class="hero-copy">描述故事，AI 总导演会拆解角色、剧本、镜头与预算。所有关键节点仍由你做决定。</p>

        <div class="prompt-card">
          <div class="prompt-heading">
            <span class="director-avatar">导</span>
            <div><b>告诉我你想拍什么</b><small>写一句话就够了，约束越具体，计划越准确</small></div>
            <span class="mock-pill" :class="{ real: !form.dry_run }">{{ form.dry_run ? '安全演练' : '真实生产' }}</span>
          </div>
          <div class="mode-selector">
            <div><b>生产模式</b><small>第一次建议先用 1 集、30 秒验证你的模型配置</small></div>
            <el-radio-group v-model="form.dry_run">
              <el-radio-button :value="false" :disabled="providerStatus && !providerOperationalReady">真实 AI 托管</el-radio-button>
              <el-radio-button :value="true">零费用演练</el-radio-button>
            </el-radio-group>
          </div>
          <div v-if="providerStatus" class="provider-strip" :class="{ ready: providerOperationalReady }">
            <span><el-icon><CircleCheck v-if="providerOperationalReady" /><Warning v-else /></el-icon>{{ providerOperationalReady ? '真实生产配置已就绪' : (providerStatus.ready ? '模型已配置，但存在已知故障' : '仍有必要模型未配置') }}</span>
            <i v-for="item in providerStatus.capabilities" :key="item.service_type" :class="{ optional: !item.required, missing: !item.configured, failing: item.configured && item.operational === false }" :title="item.known_issue || ''">{{ item.label }} · {{ item.configured ? item.model : (item.required ? '未配置' : '可选') }}{{ item.configured && item.operational === false ? ' · 需处理' : '' }}</i>
            <button v-if="!providerOperationalReady" @click="router.push('/ai-config')">检查配置</button>
          </div>
          <el-input v-model="form.instruction" type="textarea" :rows="5" resize="none" placeholder="例如：做一部3集都市职场轻喜剧，女主辞职后绑定爆款系统，每集45秒，预算300元……" />
          <div class="quick-tags">
            <span>试试：</span>
            <button @click="useExample('逆袭')">职场逆袭</button>
            <button @click="useExample('悬疑')">古风悬疑</button>
            <button @click="useExample('甜宠')">都市甜宠</button>
          </div>
          <div class="form-grid">
            <label>类型<el-select v-model="form.genre" @change="onGenreChange"><el-option v-for="item in genres" :key="item" :label="item" :value="item" /></el-select></label>
            <label>画风<el-select v-model="form.visual_style" @change="onStyleChange"><el-option v-for="item in styles" :key="item.value" :label="item.label" :value="item.value" /></el-select></label>
            <label>集数<el-input-number v-model="form.episode_count" :min="1" :max="10" /></label>
            <label>单集时长<el-select v-model="form.episode_duration_seconds"><el-option label="30 秒" :value="30"/><el-option label="45 秒" :value="45"/><el-option label="60 秒" :value="60"/><el-option label="90 秒" :value="90"/><el-option label="2 分钟（120 秒）" :value="120"/></el-select></label>
            <label>预算上限<el-input-number v-model="form.budget_limit" :min="10" :max="100000" :step="50" /></label>
          </div>
          <div class="prompt-footer">
            <el-checkbox v-model="form.save_cost">优先节省费用</el-checkbox>
            <el-button type="primary" size="large" :loading="planning" :disabled="!form.instruction.trim()" @click="makePlan">
              生成制作计划 <el-icon><Right /></el-icon>
            </el-button>
          </div>
        </div>

        <div class="promise-row">
          <div><el-icon><DocumentChecked /></el-icon><span><b>执行前确认</b><small>先看完整计划与预算</small></span></div>
          <div><el-icon><CircleCheck /></el-icon><span><b>三重审核</b><small>剧本、定妆、成片</small></span></div>
          <div><el-icon><Refresh /></el-icon><span><b>局部重做</b><small>失败镜头独立重试</small></span></div>
        </div>
      </section>

      <section v-else id="dashboard-panel" class="run-view">
        <div class="run-heading">
          <div>
            <button class="back-link" @click="newCreation"><el-icon><ArrowLeft /></el-icon> 新建创作</button>
            <div class="title-line"><h1>{{ activeRun.plan?.project?.title }}</h1><span class="status-chip" :class="statusTone(activeRun.status)">{{ statusLabel(activeRun.status) }}</span></div>
            <p>{{ activeRun.plan?.logline }}</p>
          </div>
          <div class="run-actions">
            <el-button v-if="canPause" @click="control('pause')"><el-icon><VideoPause /></el-icon>暂停</el-button>
            <el-button v-if="activeRun.status === 'PAUSED'" type="primary" @click="control('resume')"><el-icon><VideoPlay /></el-icon>{{ String(activeRun.current_step || '').startsWith('revision_required:') && !activeRun.dry_run ? '按意见重新生成' : '恢复' }}</el-button>
            <el-button v-if="activeRun.status === 'FAILED'" type="primary" @click="control('retry')"><el-icon><Refresh /></el-icon>重试失败阶段</el-button>
            <el-button v-if="activeRun.project_id" @click="router.push('/film/' + activeRun.project_id)">进入制作页</el-button>
            <el-dropdown v-if="!isTerminal" @command="control"><el-button aria-label="更多任务操作"><el-icon><MoreFilled /></el-icon></el-button><template #dropdown><el-dropdown-menu><el-dropdown-item command="cancel">取消任务</el-dropdown-item></el-dropdown-menu></template></el-dropdown>
          </div>
        </div>

        <div class="metrics-grid">
          <article><span class="metric-icon purple"><el-icon><Film /></el-icon></span><div><small>分集 / 镜头</small><b>{{ activeRun.plan?.estimated?.episodes }} <i>/</i> {{ activeRun.plan?.estimated?.shots }}</b></div></article>
          <article><span class="metric-icon blue"><el-icon><PictureFilled /></el-icon></span><div><small>图片 / 动态镜头</small><b>{{ activeRun.plan?.estimated?.images }} <i>/</i> {{ activeRun.plan?.estimated?.videos }}</b></div></article>
          <article><span class="metric-icon green"><el-icon><Wallet /></el-icon></span><div><small>预计 / 已用</small><b>¥{{ money(activeRun.estimated_cost) }} <i>/</i> ¥{{ money(activeRun.actual_cost) }}</b></div></article>
          <article><span class="metric-icon orange"><el-icon><Timer /></el-icon></span><div><small>成片时长</small><b>{{ totalDuration }} <i>秒</i></b></div></article>
        </div>

        <div class="run-layout">
          <div class="main-column">
            <article id="monitor-panel" class="panel pipeline-panel" :class="{ focused: focusPanel === 'monitor' }">
              <div class="panel-title"><div><span class="title-icon"><el-icon><Operation /></el-icon></span><span><b>生产流水线</b><small>每一步都有独立状态与追踪记录</small></span></div><span class="progress-number">{{ progressPercent }}%</span></div>
              <div class="pipeline-progress"><span :style="{ width: progressPercent + '%' }"></span></div>
              <div class="stage-list">
                <div v-for="(stage, index) in stages" :key="stage.key" class="stage-row" :class="stage.state">
                  <div class="stage-index"><el-icon v-if="stage.state === 'done'"><Check /></el-icon><span v-else>{{ index + 1 }}</span></div>
                  <div class="stage-copy"><b>{{ stage.title }}</b><small>{{ stage.description }}</small></div>
                  <div class="stage-meta"><span>{{ stage.meta }}</span><i>{{ stageStateLabel(stage.state) }}</i></div>
                </div>
              </div>
            </article>

            <article class="panel review-cycle-panel">
              <div class="panel-title"><b>独立剧本审核</b><small>初审 → 最多两次修正 → 人工接管</small></div>
              <p>检查开头、事件密度、主动选择、爽点和伏笔。图片、视频仍需分别审核。</p>
              <p v-if="!activeRun.review_cycles?.some(c => c.stage === 'script')">{{ activeRun.dry_run ? 'Mock演练不代表内容审核通过。' : '生成剧本后执行；历史任务不会自动追加付费审核。' }}</p>
              <section v-for="cycle in activeRun.review_cycles?.filter(c => c.stage === 'script')" :key="cycle.id">
                <b>{{ cycle.status === 'HUMAN_ACCEPTED' ? '人工已放行（保留原审核意见）' : cycle.status === 'PASSED' ? '文本审核通过' : cycle.status === 'HUMAN_REVIEW' ? '需要人工判断' : '审核进行中' }}</b>
                <p>{{ cycle.reason }} · 已修正 {{ cycle.versions.length - 1 }}/2 次 · 文本调用 {{ cycle.calls }}/5 次</p>
                <details><summary>创作目标</summary><p>{{ cycle.contract.direction }}</p><p>{{ cycle.contract.criteria.join('、') }}</p></details>
                <details v-for="version in cycle.versions" :key="version.number">
                  <summary>{{ version.number === 0 ? '初稿' : `修正版 ${version.number}` }} · 查看剧本与审核证据</summary>
                  <div v-for="ep in version.episodes" :key="ep.episode_number"><b>{{ ep.title }}</b><pre>{{ ep.script_content }}</pre></div>
                  <div v-for="review in cycle.reviews.filter(r => r.version === version.number)" :key="review.version">
                    <b>{{ review.decision }}</b>
                    <p v-for="check in review.checks" :key="check.criterion">{{ check.criterion }}：{{ check.status }} — {{ check.evidence }}</p>
                    <p v-for="(issue, index) in review.findings" :key="index">位置：{{ issue.location }}；证据：{{ issue.evidence }}；目标：{{ issue.requirement }}；修正要求：{{ issue.fix }}</p>
                  </div>
                </details>
                <p v-if="cycle.status === 'HUMAN_REVIEW'">可查看以上各版后填写人工放行依据，或驳回并手动修改制作页剧本；重试不会重置自动修正额度。</p>
              </section>
            </article>

            <article v-if="activeRun.review_cycles?.some(c => c.stage.startsWith('image:'))" class="panel">
              <h3>独立图片审核</h3>
              <p>只对列出的图片版本有效；审核依据为实际图片与参考图。视频动作、声音另行验收。</p>
              <section v-for="cycle in activeRun.review_cycles.filter(c => c.stage.startsWith('image:'))" :key="cycle.id">
                <b>分镜 {{ cycle.contract.shot_id }} · {{ cycle.status === 'PASSED' ? '该版本视觉通过' : cycle.status === 'HUMAN_ACCEPTED' ? '人工已放行' : cycle.status === 'RUNNING' ? '审核中' : '需要人工判断' }}</b>
                <p>{{ cycle.reason }} · 修正 {{ Math.max(0, cycle.versions.length - 1) }}/2 次 · 调用 {{ cycle.calls }}/5 次</p>
                <details v-for="version in cycle.versions" :key="version.number">
                  <summary>{{ version.number === 0 ? '原图' : `候选修正版 ${version.number}` }} · 查看画面与证据</summary>
                  <img v-if="version.image.local_path || version.image.image_url" :src="version.image.local_path ? '/static/' + version.image.local_path : version.image.image_url" style="max-width: 280px; max-height: 320px; object-fit: contain" alt="待审版本" />
                  <p v-for="e in version.evidence" :key="e.label">{{ e.label }} · 图片指纹 {{ e.sha256.slice(0, 12) }}</p>
                  <div v-for="review in cycle.reviews.filter(r => r.version === version.number)" :key="review.version">
                    <p v-for="check in review.checks" :key="check.criterion">{{ check.criterion }}：{{ check.status }} — {{ check.evidence }}</p>
                    <p v-for="(issue, i) in review.findings" :key="i">{{ issue.location }}：{{ issue.evidence }}；目标：{{ issue.requirement }}；修正：{{ issue.fix }}</p>
                  </div>
                </details>
              </section>
            </article>

            <article v-if="activeRun.review_cycles?.some(c => c.stage.startsWith('video:'))" class="panel">
              <h3>独立视频审核</h3>
              <p>抽帧只检查可见画面。请播放当前视频核对完整动作、对白、声音与口型；旧版意见不代表修改后的版本。</p>
              <section v-for="cycle in activeRun.review_cycles.filter(c => c.stage.startsWith('video:'))" :key="cycle.id">
                <b>分镜 {{ cycle.contract.shot_id }} · {{ cycle.status === 'HUMAN_ACCEPTED' ? '人工已放行' : '等待人工核对' }}</b>
                <p>{{ cycle.reason }} · 定向修正 {{ Math.max(0, cycle.versions.length - 1) }}/2 · 调用 {{ cycle.calls }}/5</p>
                <details v-for="version in cycle.versions" :key="version.number">
                  <summary>{{ version.number === 0 ? '原视频' : `候选修正版 ${version.number}` }} · {{ version.inspection.status }}</summary>
                  <video v-if="version.video.local_path || version.video.video_url" controls preload="metadata" :src="version.video.local_path ? '/static/' + version.video.local_path : mediaUrl(version.video.video_url)" style="max-width:100%;max-height:380px" />
                  <p v-for="check in version.inspection.checks" :key="check.key">{{ check.passed ? '技术通过' : '未通过' }}：{{ check.evidence }}</p>
                  <div style="display:flex;flex-wrap:wrap;gap:8px"><figure v-for="frame in version.inspection.frames" :key="frame.path" style="margin:0"><img :src="'/static/'+frame.path" style="width:100px" :alt="`${frame.time}秒抽帧`" /><figcaption>{{ frame.time }} 秒</figcaption></figure></div>
                  <div v-for="review in cycle.reviews.filter(r=>r.version===version.number)" :key="review.version">
                    <p v-for="check in review.checks" :key="check.criterion">{{ check.criterion }}：{{ check.status }} — {{ check.evidence }}</p>
                    <p v-for="(issue,i) in review.findings" :key="i">{{ issue.location }}：{{ issue.evidence }}；修正：{{ issue.fix }}</p>
                  </div>
                </details>
              </section>
            </article>

            <article v-if="!activeRun.dry_run && activeRun.approvals?.some(a => a.approval_stage === 'final_video' && a.status === 'APPROVED')" class="panel">
              <h3>ChatCut 剪辑稿</h3>
              <p>用已审核镜头创建独立时间线，保留原工程。只做本地剪辑，不重新生成素材；配音对齐与最终观感仍需审核。</p>
              <el-button v-if="!chatcutConnection" :loading="chatcutBusy" @click="connectChatcut">连接已打开的 ChatCut</el-button>
              <template v-else><p>目标工程：{{ chatcutConnection.name }}</p><el-button :loading="chatcutBusy" @click="prepareChatcut">创建剪辑稿并导出</el-button></template>
              <p v-if="chatcutError" role="alert">{{ chatcutError }}</p>
              <section v-for="job in activeRun.editing_jobs || []" :key="job.id">
                <b>剧集 {{ job.episode_id }} · {{ chatcutLabel(job.status) }}</b>
                <p v-if="job.error">{{ job.error }}</p>
                <details v-if="job.timeline_id && job.status !== 'EXPORT_QUEUED'"><summary>在 ChatCut 中调整过镜头？</summary>
                  <p>可采用镜头裁切、顺序、音量及字幕图层修改。修改后重新导出、重新审核，旧文件保留；图层源码缺失不影响审核这份导出视频，重新导出后仍须重新审核。</p>
                  <el-button :disabled="chatcutBusy" @click="adoptChatcut(job)">核对并采用当前剪辑版本</el-button>
                </details>
                <el-button v-if="job.status === 'READY'" :disabled="chatcutBusy" @click="exportChatcut(job)">导出这版剪辑稿</el-button>
                <p v-if="job.status === 'EXPORT_QUEUED'">ChatCut 正在本机渲染；文件通过检查后自动显示。</p>
                <template v-if="['REVIEW_REQUIRED','APPROVED'].includes(job.status) && job.output">
                  <p>{{ job.status === 'APPROVED' ? '这版文件已有人工审核记录。' : '文件检查通过，等待完整动作、声音和剧情审核。' }}</p>
                  <p v-if="job.output.layer_evidence?.gaps?.length">工程源码证据缺口（不等于视频有错）：{{ job.output.layer_evidence.gaps.map(g => g.reason).join("；") }}</p>
                  <p v-if="job.output.signal_review">全片扫描完成；冻结 {{ job.output.signal_review.signals.freeze.length }} 段、黑场 {{ job.output.signal_review.signals.black.length }} 段、静音 {{ job.output.signal_review.signals.silence.length }} 段，需结合剧情复核。</p>
                  <video controls preload="metadata" :src="job.output.url" style="max-width:100%;max-height:480px" />
                  <div>
                    <b>本地音频核对 · {{ audioReviewLabel(job.audio_review?.status) }}</b>
                    <p v-if="!activeRun.local_audio_review_available">本机尚未安装语音模型，不会自动调用付费 API。</p>
                    <el-button v-if="!job.audio_review || ['FAILED','INTERRUPTED'].includes(job.audio_review.status)" :disabled="chatcutBusy || !activeRun.local_audio_review_available" @click="startAudioReview(job)">{{ job.audio_review ? '重试本地核对' : '核对这版音频' }}</el-button>
                    <p v-if="job.audio_review?.error" role="alert">{{ job.audio_review.error }}</p>
                    <template v-if="job.audio_review?.result">
                      <p>转写用于核对台词，不自动认定声音质量或成片通过。</p>
                      <p v-if="job.audio_review.result.unmatched_segments?.length">{{ job.audio_review.result.unmatched_segments.length }} 段识别语音未匹配预期台词，请在整轨转写中复核。</p>
                      <p v-for="gap in job.audio_review.result.alignment_gaps" :key="gap">{{ gap }}</p>
                      <details><summary>查看逐句核对与转写</summary>
                        <article v-for="row in job.audio_review.result.rows" :key="row.item_id">
                          <button type="button" @click="seekAudioReview($event, row.start)">{{ row.start.toFixed(1) }} 秒 · 定位播放</button>
                          <p>预期：{{ row.text }}</p><p>识别：{{ row.recognized || '未识别到' }}</p>
                          <small>{{ row.status === 'TEXT_MATCH' ? '文本匹配' : '差异待复核' }}{{ row.low_confidence ? ' · 识别置信度低' : '' }}</small>
                        </article>
                        <p v-for="(segment, index) in job.audio_review.result.transcript.segments" :key="index">{{ segment.start.toFixed(1) }}–{{ segment.end.toFixed(1) }} 秒：{{ segment.text }}</p>
                      </details>
                    </template>
                  </div>
                  <a :href="job.output.url" download>{{ job.status === 'APPROVED' ? '下载人工验收版' : '下载待审剪辑稿' }}</a>
                  <el-button v-if="job.status === 'REVIEW_REQUIRED'" :disabled="chatcutBusy" @click="approveChatcut(job)">记录成片审核</el-button>
                  <p v-if="job.output.review?.scope === 'EXPORTED_FILE_ONLY'">验收范围：这份导出视频。工程后续导出不继承本次验收。</p>
                  <p v-if="job.output.review">审核依据：{{ job.output.review.comment }}</p>
                </template>
              </section>
              <details><summary>高级交接</summary><a :href="`/api/v1/agent/runs/${activeRun.id}/editing-handoff`" download>下载剪辑交接清单</a></details>
            </article>

            <article v-if="exportedEpisodes.length" class="panel">
              <h3>合成结果</h3><p>以下为自动合成稿，已完成解码、时长和画幅检查。合成后的音画、字幕和剧情仍需审核。</p>
              <section v-for="ep in exportedEpisodes" :key="ep.episode_id">
                <b>剧集 {{ ep.episode_id }} · {{ ep.inspection.duration.toFixed(2) }} 秒 · {{ ep.inspection.width }}×{{ ep.inspection.height }}</b>
                <video controls preload="metadata" :src="mediaUrl(ep.path)" style="max-width:100%;max-height:480px" />
                <a :href="mediaUrl(ep.path)" download>下载待审合成稿</a>
              </section>
            </article>

            <article class="panel episode-panel">
              <div class="panel-title"><div><span class="title-icon"><el-icon><Tickets /></el-icon></span><span><b>分集计划</b><small>结构、节奏和镜头规模</small></span></div></div>
              <div class="episode-grid">
                <div v-for="episode in activeRun.plan?.episodes" :key="episode.episode_number" class="episode-card-mini">
                  <span>EP {{ String(episode.episode_number).padStart(2, '0') }}</span><b>{{ episode.title.replace(/^第\d+集 · /, '') }}</b><p>{{ episode.synopsis }}</p><small>{{ episode.shots }} 镜 · {{ activeRun.plan?.project?.episode_duration_seconds }} 秒</small>
                </div>
              </div>
            </article>
          </div>

          <aside class="right-column">
            <article id="approvals-panel" class="panel approval-panel" :class="{ attention: pendingApproval, focused: focusPanel === 'approvals' }">
              <div class="panel-title compact"><div><span class="title-icon"><el-icon><Stamp /></el-icon></span><span><b>审核台</b><small>人是最后的导演</small></span></div></div>
              <template v-if="pendingApproval">
                <div class="approval-kicker"><span></span>等待你的决定</div>
                <h3>{{ approvalTitle(pendingApproval.approval_stage) }}</h3>
                <p>{{ approvalDescription(pendingApproval.approval_stage) }}</p>
                <button class="approval-preview" @click="openProductionPage">
                  <span><el-icon><View /></el-icon></span>
                  <div><b>{{ approvalPreviewTitle }}</b><small>{{ approvalPreviewMeta }}</small></div>
                  <el-icon class="preview-arrow"><Right /></el-icon>
                </button>
                <div v-if="pendingApproval.approval_stage === 'images'" class="image-gate-grid">
                  <p v-if="activeRun.dry_run">Mock无真实图片，仅验证审核门，不代表画面通过。</p>
                  <figure v-for="shot in pendingApproval.snapshot?.shots || []" :key="shot.id">
                    <img v-if="shot.local_path || shot.image_url" :src="shot.local_path ? '/static/' + shot.local_path : shot.image_url" :alt="shot.title || '分镜图片'" loading="lazy" />
                    <span v-else>图片尚未生成</span>
                    <figcaption>镜头 {{ shot.storyboard_number }} · {{ shot.title }}<br />{{ shot.action || shot.description }}</figcaption>
                  </figure>
                </div>
                <el-alert v-if="approvalBlockingMessage" type="error" :closable="false" :title="approvalBlockingMessage" />
                <el-alert v-else-if="approvalWarnings.length" type="warning" :closable="false" :title="approvalWarnings[0]" />
                <el-button type="primary" size="large" :disabled="Boolean(approvalBlockingMessage)" :loading="acting" @click="resolveApproval('approve')"><el-icon><Check /></el-icon>通过并继续</el-button>
                <el-button size="large" @click="rejectVisible = true">驳回修改</el-button>
                <small class="approval-note"><el-icon><Lock /></el-icon>未通过前不会进入下一阶段</small>
              </template>
              <div v-else class="approval-empty">
                <span><el-icon><CircleCheckFilled /></el-icon></span><b>{{ activeRun.status === 'CANCELLED' ? '任务已取消' : isTerminal ? (activeRun.dry_run ? '流程演练结束' : exportedEpisodes.length ? '合成文件检查通过' : '历史任务已结束') : '暂无待审核项' }}</b><p>{{ activeRun.status === 'CANCELLED' ? '已停止后续任务。' : isTerminal ? (activeRun.dry_run ? 'Mock只演练状态，不生成视频文件。' : exportedEpisodes.length ? '可查看已合成的文件与实测结果。' : '该历史任务没有本轮文件检查记录。') : 'AI 正在准备下一阶段内容。' }}</p>
              </div>
            </article>

            <article class="panel agent-chat-panel">
              <div class="panel-title compact"><div><span class="title-icon"><el-icon><ChatDotRound /></el-icon></span><span><b>和 AI 导演沟通</b><small>直接说修改要求，AI 会重做当前阶段</small></span></div></div>
              <div class="chat-history" role="log" tabindex="0" aria-label="AI 导演对话记录">
                <div class="chat-message assistant"><span>AI</span><p>{{ agentGuidance }}</p></div>
                <template v-for="item in revisionMessages" :key="item.id">
                  <div class="chat-message user"><span>你</span><p>{{ item.reviewer_comment }}</p></div>
                  <div class="chat-message assistant"><span>AI</span><p>已收到并保留这条修改要求。</p></div>
                </template>
              </div>
              <div class="chat-suggestions" v-if="pendingApproval">
                <button v-for="suggestion in chatSuggestions" :key="suggestion" @click="chatInput = suggestion">{{ suggestion }}</button>
              </div>
              <el-input v-model="chatInput" type="textarea" :rows="3" resize="none" :disabled="!pendingApproval || acting" placeholder="例如：人物服装改成暖黄色，保留夜景氛围；第三个镜头节奏再快一些……" @keydown.meta.enter.prevent="sendRevision" @keydown.ctrl.enter.prevent="sendRevision" />
              <div class="chat-actions"><small>{{ pendingApproval ? '⌘/Ctrl + Enter 发送' : '下一审核节点出现后即可继续沟通' }}</small><el-button type="primary" :loading="acting" :disabled="!pendingApproval || !chatInput.trim()" @click="sendRevision">{{ scriptHandoff || pendingApproval?.approval_stage === 'images' ? '记录人工修改意见' : pendingApproval?.approval_stage === 'final_video' ? '记录意见并复查当前视频' : '发送并重新生成' }}</el-button></div>
            </article>

            <article id="cost-panel" class="panel budget-panel" :class="{ focused: focusPanel === 'cost' }">
              <div class="panel-title compact"><div><span class="title-icon"><el-icon><PieChart /></el-icon></span><span><b>预算护栏</b><small>{{ activeRun.dry_run ? '演练不会产生费用' : '按模型计划单价估算' }}</small></span></div></div>
              <div class="budget-row"><span>{{ activeRun.dry_run ? 'Mock 消耗' : '已发起调用估算' }}</span><b>¥{{ money(activeRun.actual_cost) }} <i>/ ¥{{ money(activeRun.budget_limit) }}</i></b></div>
              <el-progress aria-label="预算使用比例" :percentage="budgetPercent" :show-text="false" :stroke-width="8" color="#7c5cff" />
              <div class="budget-stats"><span><small>预计成本</small><b>¥{{ money(activeRun.estimated_cost) }}</b></span><span><small>预算余量</small><b>¥{{ money(Math.max(0, activeRun.budget_limit - activeRun.estimated_cost)) }}</b></span></div>
              <div class="budget-safe"><el-icon><CircleCheck /></el-icon>{{ activeRun.dry_run ? '当前为演练模式，不会请求付费 API' : '任何阶段失败都会停止；可只重试失败阶段' }}</div>
            </article>

            <article v-if="activeRun.qc_reports?.length" class="panel qc-panel">
              <div class="panel-title compact"><div><span class="title-icon"><el-icon><Aim /></el-icon></span><span><b>自动质检</b><small>{{ qc.total }} 个素材检查记录</small></span></div></div>
              <div class="qc-score"><strong>{{ qc.displayPassed }}/{{ qc.total }}</strong><span><b>{{ qc.label }}</b></span></div>
              <div class="qc-tags"><span v-if="qc.issues">{{ qc.issues }} 项需处理</span><span>{{ qc.note }}</span></div>
            </article>
          </aside>
        </div>
      </section>
    </main>

    <el-dialog v-model="planVisible" title="制作计划确认" width="760px" :close-on-click-modal="false">
        <div v-if="plan" class="plan-dialog">
        <div class="plan-hero"><span>AI 制作提案</span><h2>{{ plan.project.title }}</h2><p>{{ plan.logline }}</p><small>美术方向 · {{ getStyleLabel(plan.project.visual_style) }}{{ plan.project.visual_style_auto ? '（AI 推荐）' : '' }}</small></div>
        <div class="plan-numbers"><div><b>{{ plan.estimated.episodes }}</b><small>集</small></div><div><b>{{ plan.estimated.shots }}</b><small>镜头</small></div><div><b>{{ plan.estimated.videos }}</b><small>动态镜头</small></div><div><b>¥{{ money(plan.estimated.estimated_cost) }}</b><small>预计成本</small></div></div>
        <el-alert v-if="plan.budget_warning" type="warning" :closable="false" title="预计费用超过预算，请返回调整参数。" />
        <el-alert v-else-if="!plan.dry_run" type="warning" :closable="false" title="真实生产会调用付费 API；金额为估算，最终费用以供应商账单为准。" />
        <el-alert v-if="plan.configuration_blocked" type="error" :closable="false" title="必要模型尚未配置完整，请先前往 AI 配置。" />
        <h4>故事节奏</h4>
        <div class="plan-episodes"><div v-for="ep in plan.episodes" :key="ep.episode_number"><span>0{{ ep.episode_number }}</span><b>{{ ep.title }}</b><p>{{ ep.synopsis }}</p></div></div>
        <div class="gate-row"><span v-for="gate in plan.approval_gates" :key="gate"><el-icon><CircleCheck /></el-icon>{{ approvalTitle(gate) }}</span></div>
      </div>
      <template #footer><el-button @click="planVisible = false">返回修改</el-button><el-button type="primary" :disabled="plan?.budget_warning || plan?.configuration_blocked" :loading="creating" @click="confirmPlan">{{ plan?.dry_run ? '开始安全演练' : '确认费用并生成真实剧本' }}</el-button></template>
    </el-dialog>

    <el-dialog v-model="rejectVisible" title="驳回并要求修改" width="480px">
      <p class="reject-hint">请说明需要调整的内容。该意见会保留在审核记录中。</p>
      <el-input v-model="rejectComment" type="textarea" :rows="4" placeholder="例如：女主服装颜色需要改为更醒目的黄色，第三集反转提前两个镜头……" />
      <template #footer><el-button @click="rejectVisible = false">取消</el-button><el-button type="danger" :disabled="!rejectComment.trim()" :loading="acting" @click="resolveApproval('reject')">确认驳回</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { agentAPI } from '@/api/agent'
import { summarizeQc } from '@/utils/qcSummary'
import { useTheme } from '@/composables/useTheme'
import { SUSPENSE_MANHUA_STYLE_VALUE, SUSPENSE_REALISTIC_STYLE_VALUE, getStyleLabel, recommendWorkbenchStyle } from '@/constants/styleOptions'

const router = useRouter()
const route = useRoute()
const { isDark, toggle: toggleTheme } = useTheme()
const genres = ['都市轻喜剧', '悬疑反转', '恐怖惊悚', '古风奇幻', '甜宠爱情', '科幻冒险']
const styles = [
  { label: '2.5D国漫', value: '2.5D国漫' },
  { label: '写实电影·都市悬疑（悬疑推荐）', value: SUSPENSE_REALISTIC_STYLE_VALUE },
  { label: '都市怪谈悬疑漫剧（悬疑推荐）', value: SUSPENSE_MANHUA_STYLE_VALUE },
  { label: '动态漫画', value: '动态漫画' },
  { label: '轻写实电影感', value: '轻写实电影感' },
  { label: '水墨国风', value: '水墨国风' },
  { label: '赛博朋克', value: '赛博朋克' },
]
const examples = {
  '逆袭': '做一部《辞职后，我绑定了爆款系统》的3集都市职场轻喜剧，女主辞职后意外绑定系统，每集45秒，预算300元。',
  '悬疑': '做一部3集古风悬疑短剧，女仵作发现王府密室中的尸体竟与十年前旧案有关，每集60秒，预算500元。',
  '甜宠': '做一部3集都市甜宠短剧，社恐插画师与高冷邻居因一只走失的猫相识，每集45秒，预算300元。',
}
const exampleSettings = {
  '逆袭': { genre: '都市轻喜剧', episode_count: 3, episode_duration_seconds: 45, budget_limit: 300 },
  '悬疑': { genre: '悬疑反转', episode_count: 3, episode_duration_seconds: 60, budget_limit: 500 },
  '甜宠': { genre: '甜宠爱情', episode_count: 3, episode_duration_seconds: 45, budget_limit: 300 },
}
const form = reactive({ instruction: examples['逆袭'], genre: '都市轻喜剧', visual_style: '2.5D国漫', visual_style_auto: true, episode_count: 1, episode_duration_seconds: 30, budget_limit: 100, save_cost: true, dry_run: true })
const runs = ref([])
const activeRun = ref(null)
const chatcutConnection = ref(null)
const chatcutBusy = ref(false)
const chatcutError = ref('')
let chatcutCollecting = false
function chatcutLabel(status) { return ({BUILDING:'正在创建时间线',READY:'剪辑稿已就绪',EXPORT_QUEUED:'正在导出',REVIEW_REQUIRED:'待内容审核',APPROVED:'人工已验收此版本',BLOCKED:'需要核对后恢复'})[status] || status }
async function adoptChatcut(job) {
  const id = activeRun.value?.id
  let comment
  try { const answer = await ElMessageBox.prompt('说明你调整了哪些镜头、顺序或音量。采用后本版需要重新导出和审核。', '采用剪辑修改', { inputValidator: v => v?.trim().length >= 5 || '请填写至少5字的修改说明' }); comment = answer.value } catch { return }
  if (activeRun.value?.id !== id) return
  chatcutBusy.value = true
  try { await agentAPI.chatcutAdopt(id, job.id, comment); await refreshActive() }
  catch(e) { chatcutError.value = e.message || '剪辑版本无法采用' }
  finally { chatcutBusy.value = false }
}
function audioReviewLabel(status) {
  return ({ QUEUED:'排队中', RUNNING:'转写中', DONE:'核对完成，待内容复核', FAILED:'失败', INTERRUPTED:'已中断', STALE:'版本已失效' })[status] || '尚未开始'
}
function seekAudioReview(event, time) {
  const video = event.currentTarget.closest('section')?.querySelector('video')
  if (video) { video.currentTime = time; video.play().catch(() => {}) }
}
async function startAudioReview(job) {
  chatcutBusy.value = true; chatcutError.value = ''
  try { await agentAPI.chatcutAudioReview(activeRun.value.id, job.id, true); await refreshActive() }
  catch (e) { chatcutError.value = e.message || '音频审核未启动' }
  finally { chatcutBusy.value = false }
}
async function approveChatcut(job) {
  const id = activeRun.value?.id
  let comment
  try { const answer = await ElMessageBox.prompt('请完整播放后记录人物动作、声音、台词与剧情的审核依据；此记录仅验收当前导出文件，不证明工程源码已核验；重新导出必须重新审核。', '成片内容审核', { inputValidator: v => v?.trim().length >= 5 || '请填写至少5字的审核依据' }); comment = answer.value }
  catch { return }
  if (activeRun.value?.id !== id) return
  chatcutBusy.value = true
  try { await agentAPI.chatcutApprove(id, job.id, comment); await refreshActive() }
  catch(e) { chatcutError.value = e.message || '审核未通过版本核验' }
  finally { chatcutBusy.value = false }
}
async function connectChatcut() {
  chatcutBusy.value = true; chatcutError.value = ''
  try { chatcutConnection.value = await agentAPI.chatcutConnection() }
  catch (e) { chatcutError.value = e.message || '请打开 ChatCut 并选择目标工程' }
  finally { chatcutBusy.value = false }
}
async function prepareChatcut() {
  const id = activeRun.value?.id
  if (!id || !chatcutConnection.value || chatcutBusy.value) return
  chatcutBusy.value = true; chatcutError.value = ''
  try {
    const jobs = await agentAPI.chatcutPrepare(id, chatcutConnection.value.project_id)
    for (const job of jobs.filter(j => j.status === 'READY' && j.project_id === chatcutConnection.value.project_id)) await agentAPI.chatcutExport(id, job.id)
    await refreshActive()
  } catch (e) { chatcutError.value = e.message || '剪辑未完成，请检查任务记录'; await refreshActive() }
  finally { chatcutBusy.value = false }
}
async function exportChatcut(job) {
  chatcutBusy.value = true
  try { await agentAPI.chatcutExport(activeRun.value.id, job.id); await refreshActive() }
  catch(e) { chatcutError.value = e.message || '导出未完成' }
  finally { chatcutBusy.value = false }
}
const qc = computed(() => summarizeQc(activeRun.value?.qc_reports, activeRun.value?.dry_run))
const providerStatus = ref(null)
const plan = ref(null)
const planning = ref(false)
const creating = ref(false)
const acting = ref(false)
const planVisible = ref(false)
const rejectVisible = ref(false)
const rejectComment = ref('')
const chatInput = ref('')
const focusPanel = ref('dashboard')
let pollTimer = null

const pendingApproval = computed(() => activeRun.value?.approvals?.find((item) => item.status === 'PENDING'))
const providerOperationalReady = computed(() => providerStatus.value?.operational_ready ?? providerStatus.value?.ready ?? false)
const totalDuration = computed(() => (activeRun.value?.plan?.estimated?.episodes || 0) * (activeRun.value?.plan?.project?.episode_duration_seconds || 0))
const exportedEpisodes = computed(() => activeRun.value?.steps?.filter(s=>s.step_key==='real_export_ready' && s.status==='COMPLETED').at(-1)?.output?.episodes?.filter(e=>e.path && e.inspection) || [])
const isTerminal = computed(() => ['EXPORTED', 'CANCELLED'].includes(activeRun.value?.status))
const canPause = computed(() => activeRun.value && !isTerminal.value && !['PAUSED', 'FAILED'].includes(activeRun.value.status))
const budgetPercent = computed(() => Math.min(100, Math.round(((activeRun.value?.estimated_cost || 0) / Math.max(1, activeRun.value?.budget_limit || 1)) * 100)))
const progressPercent = computed(() => {
  const map = { SCRIPT_GENERATING: 16, SCRIPT_REVIEW: 28, ASSET_GENERATING: 40, ASSET_REVIEW: 55, IMAGE_GENERATING: 62, IMAGE_REVIEW: 68, MEDIA_GENERATING: 76, MEDIA_REVIEWING: 82, FINAL_REVIEW: 88, EXPORTING: 95, EXPORTED: 100, PAUSED: 40, FAILED: 40, CANCELLED: 0 }
  return map[activeRun.value?.status] ?? 10
})
const stages = computed(() => {
  const done = new Set((activeRun.value?.steps || []).filter((s) => s.status === 'COMPLETED').map((s) => s.step_key))
  const status = activeRun.value?.status
  return [
    { key: 'plan', title: '创意解析与制作计划', description: '结构化目标、镜头规模与成本', meta: `${activeRun.value?.plan?.estimated?.shots || 0} 镜`, state: done.has('plan_confirmed') ? 'done' : 'active' },
    { key: 'script', title: '故事圣经与分集剧本', description: '分集梗概、对白与结尾钩子', meta: `${activeRun.value?.plan?.estimated?.episodes || 0} 集`, state: done.has('script_generated') || done.has('real_script_generated') ? (status === 'SCRIPT_REVIEW' ? 'active' : 'done') : status === 'SCRIPT_GENERATING' ? 'active' : 'pending' },
    { key: 'assets', title: '视觉资产与结构化分镜', description: '角色锚点、场景与镜头提示词', meta: '角色一致性', state: done.has('assets_generated') || done.has('real_assets_generated') ? (status === 'ASSET_REVIEW' ? 'active' : 'done') : status === 'ASSET_GENERATING' ? 'active' : 'pending' },
    { key: 'images', title: '分镜图片生成与审核', description: '先检查实际图片，通过后才生成视频', meta: '独立审核门', state: ['IMAGE_GENERATING', 'IMAGE_REVIEW'].includes(status) ? 'active' : done.has('real_images_generated') || done.has('mock_images_generated') ? 'done' : 'pending' },
    { key: 'media', title: '视频与配音', description: activeRun.value?.dry_run ? 'Mock 素材生成与逐镜费用记录' : '真实关键帧、动态镜头与可选配音', meta: '托管生产', state: done.has('mock_media_generated') || done.has('real_media_generated') ? 'done' : status === 'MEDIA_GENERATING' ? 'active' : 'pending' },
    { key: 'qc', title: '自动质检与成片', description: '文件实测与抽帧证据；完整动作/声音需人工确认', meta: qc.value.label, state: status === 'EXPORTED' ? 'done' : ['FINAL_REVIEW','MEDIA_REVIEWING'].includes(status) ? 'active' : 'pending' },
  ]
})
const approvalPreviewTitle = computed(() => pendingApproval.value?.approval_stage === 'images' ? '逐张查看分镜图片与动作要求' : pendingApproval.value?.approval_stage === 'script' ? `${activeRun.value?.plan?.estimated?.episodes} 集剧本提案` : pendingApproval.value?.approval_stage === 'assets' ? `角色定妆 · 场景 · ${activeRun.value?.plan?.estimated?.shots} 个分镜` : (activeRun.value?.dry_run ? 'Mock 成片与质检报告' : '真实镜头与自动质检报告'))
const approvalPreviewMeta = computed(() => pendingApproval.value?.approval_stage === 'final_video' ? qc.value.label : '点击进入现有制作页可查看完整内容')
const approvalWarnings = computed(() => pendingApproval.value?.snapshot?.warnings || [])
const scriptHandoff = computed(() => pendingApproval.value?.approval_stage === 'script' && activeRun.value?.review_cycles?.some(c => c.stage === 'script' && c.status === 'HUMAN_REVIEW'))
const revisionMessages = computed(() => (activeRun.value?.approvals || [])
  .filter((item) => item.status === 'REJECTED' && item.reviewer_comment)
  .slice()
  .reverse())
const agentGuidance = computed(() => {
  if (!activeRun.value) return '先告诉我你想拍什么，我会整理成可确认的生产计划。'
  if (pendingApproval.value?.approval_stage === 'script') return '剧本已经准备好。你可以直接告诉我人物、节奏、对白或结尾需要怎么改。'
  if (pendingApproval.value?.approval_stage === 'images') return '请对照动作要求逐张检查图片；问题镜头可在制作页局部修改，恢复后重新审核，不会自动批量重生。'
  if (pendingApproval.value?.approval_stage === 'assets') return '角色、场景和分镜已经准备好。你可以修改造型、色调、构图或镜头节奏。'
  if (pendingApproval.value?.approval_stage === 'final_video') return '镜头检查已完成。请查看实际视频与未通过项；局部修改后恢复只复查，不批量重新生成。'
  return 'AI 正在执行当前任务；到达下一个审核节点后，我会在这里等待你的修改意见。'
})
const chatSuggestions = computed(() => pendingApproval.value?.approval_stage === 'script'
  ? ['开头冲突更强', '对白更口语化', '结尾增加反转']
  : pendingApproval.value?.approval_stage === 'images'
    ? ['人物身份与定妆不一致', '关键动作没有表达清楚', '道具或构图需要局部修改']
  : pendingApproval.value?.approval_stage === 'assets'
    ? ['人物更有辨识度', '整体改为暖色调', '镜头节奏更紧凑']
    : ['重做问题镜头', '配音更自然', '字幕更易读'])
const approvalBlockingMessage = computed(() => {
  if (activeRun.value?.dry_run !== false || !pendingApproval.value) return ''
  const snapshot = pendingApproval.value.snapshot || {}
  if (pendingApproval.value.approval_stage === 'images' && (!snapshot.total || snapshot.images_completed !== snapshot.total)) return '分镜图片尚未齐全。请在制作页补齐问题镜头，驳回后恢复审核以刷新图片版本。'
  if (pendingApproval.value.approval_stage === 'assets' && Number(snapshot.reference_images_completed || 0) < 1) return '参考图全部生成失败：请先检查图片模型配置，然后驳回并重新生成。'
  if (pendingApproval.value.approval_stage === 'final_video' && snapshot.inspections?.some(i=>i.report.status === 'BLOCKED')) return '存在未通过文件、时长或画幅检查的镜头，请局部修复后驳回并恢复复查。'
  if (pendingApproval.value.approval_stage === 'final_video' && Number(snapshot.videos_completed || 0) < 1) return '没有可合成的视频片段，请先修复失败镜头。'
  return ''
})

function money(value) { return Number(value || 0).toFixed(2) }
function applyRecommendedStyle() {
  form.visual_style = recommendWorkbenchStyle(form.genre, form.instruction, form.visual_style, form.visual_style_auto)
}
function onGenreChange() { applyRecommendedStyle() }
function onStyleChange() { form.visual_style_auto = false }
function useExample(key) {
  form.instruction = examples[key]
  Object.assign(form, exampleSettings[key])
  form.visual_style_auto = true
  applyRecommendedStyle()
}
function statusLabel(status) { return ({ SCRIPT_GENERATING: 'AI 正在写剧本', SCRIPT_REVIEW: '等待剧本审核', ASSET_GENERATING: '正在生成角色与分镜', ASSET_REVIEW: '等待定妆审核', IMAGE_GENERATING: '正在生成分镜图片', IMAGE_REVIEW: '等待分镜图片审核', MEDIA_GENERATING: '正在生成视频与配音', MEDIA_REVIEWING: '正在检查实际视频', FINAL_REVIEW: '等待成片审核', EXPORTING: '正在合成成片', EXPORTED: '已合成，内容待审', PAUSED: '已暂停', CANCELLED: '已取消', FAILED: '执行失败，可重试' })[status] || status || '准备中' }
function statusTone(status) { return status === 'EXPORTED' ? 'success' : status === 'PAUSED' || status === 'CANCELLED' ? 'muted' : 'active' }
function stageStateLabel(state) { return ({ done: '已完成', active: '进行中', pending: '待开始' })[state] }
function mediaUrl(value) { return !value || /^(https?:|\/static\/)/.test(value) ? value : '/static/' + value }
function approvalTitle(stage) { return ({ script: '剧本审核', assets: '角色定妆与分镜方案审核', images: '分镜图片审核', final_video: '镜头视频与配音审核' })[stage] || stage }
function approvalDescription(stage) { return ({ script: '确认人物动机、剧情节奏与分集钩子。通过后才会创建视觉资产。', assets: '确认角色定妆、场景方向和全部镜头提示词。通过后只生成分镜图片，视频需再次审核。', images: '逐张检查人物身份、动作、道具和构图。全部图片审核通过后才生成视频；修改上游后必须重新审核。', final_video: activeRun.value?.dry_run ? '确认后完成流程演练；Mock不会生成视频或导出包。' : '检查真实镜头与质检警告，确认后自动合成各集成片。' })[stage] || '' }

async function makePlan() {
  planning.value = true
  try { applyRecommendedStyle(); plan.value = await agentAPI.plan({ ...form }); planVisible.value = true }
  finally { planning.value = false }
}
async function confirmPlan() {
  creating.value = true
  try {
    if (!plan.value.dry_run) {
      try {
        await ElMessageBox.confirm(`即将调用真实 AI，计划估算 ¥${money(plan.value.estimated.estimated_cost)}，预算上限 ¥${money(form.budget_limit)}。是否继续？`, '确认真实生产', { type: 'warning', confirmButtonText: '确认并开始', cancelButtonText: '再检查一下' })
      } catch { return }
    }
    activeRun.value = await agentAPI.createRun({ plan: plan.value, budget_limit: form.budget_limit, dry_run: plan.value.dry_run })
    planVisible.value = false
    await loadRuns()
    ElMessage.success(plan.value.dry_run ? '演练项目已创建，剧本等待审核' : '真实项目已创建，AI 正在生成剧本')
  } finally { creating.value = false }
}
async function loadRuns() { runs.value = await agentAPI.listRuns() }
async function selectRun(id) { activeRun.value = await agentAPI.getRun(id); focusPanel.value = 'dashboard' }
async function refreshActive() {
  const id = activeRun.value?.id
  if (!id) return
  const updated = await agentAPI.getRun(id)
  if (activeRun.value?.id !== id) return
  activeRun.value = updated
  runs.value = runs.value.map(run => run.id === id ? { ...run, status: updated.status } : run)
  if (!chatcutBusy.value && !chatcutCollecting && updated.editing_jobs?.some(j => j.status === 'EXPORT_QUEUED')) {
    chatcutCollecting = true
    try { for (const job of updated.editing_jobs.filter(j => j.status === 'EXPORT_QUEUED')) await agentAPI.chatcutCollect(id, job.id) }
    catch(e) { if (activeRun.value?.id === id) chatcutError.value = e.message || '导出回传需核对' }
    finally { chatcutCollecting = false }
  }
}
async function resolveApproval(decision) {
  if (!pendingApproval.value) return
  acting.value = true
  try {
    let reason = ''
    if (decision === 'approve' && ((pendingApproval.value.approval_stage === 'final_video' && !activeRun.value.dry_run) || activeRun.value.review_cycles?.some(c => (c.stage === pendingApproval.value.approval_stage || (pendingApproval.value.approval_stage === 'images' && c.stage.startsWith('image:')) || (pendingApproval.value.approval_stage === 'final_video' && c.stage.startsWith('video:'))) && c.status === 'HUMAN_REVIEW'))) {
      try { const answer = await ElMessageBox.prompt('请填写人工放行依据；未解决问题将保留在审核记录中。', '人工审核', { inputValidator: v => Boolean(v?.trim()) || '请输入判断依据' }); reason = answer.value } catch { return }
    }
    activeRun.value = decision === 'approve' ? await agentAPI.approve(pendingApproval.value.id, reason) : await agentAPI.reject(pendingApproval.value.id, rejectComment.value)
    rejectVisible.value = false
    rejectComment.value = ''
    await loadRuns()
    ElMessage.success(decision === 'approve' ? '已通过，下一阶段已启动' : '已驳回，任务已暂停')
  } finally { acting.value = false }
}
async function control(action) {
  if (!activeRun.value) return
  if (action === 'cancel') {
    try { await ElMessageBox.confirm('取消后该运行不能继续，已生成的项目数据仍会保留。', '取消任务', { type: 'warning' }) } catch { return }
  }
  activeRun.value = await agentAPI[action](activeRun.value.id)
  await loadRuns()
}
async function showPanel(panel) {
  if (!activeRun.value && runs.value.length) await selectRun(runs.value[0].id)
  focusPanel.value = panel
  await nextTick()
  const panelId = ({ dashboard: 'dashboard-panel', approvals: 'approvals-panel', monitor: 'monitor-panel', cost: 'cost-panel' })[panel]
  document.getElementById(panelId)?.scrollIntoView({ behavior: 'smooth', block: panel === 'dashboard' ? 'start' : 'center' })
}
function openProductionPage() {
  if (activeRun.value?.project_id) router.push('/film/' + activeRun.value.project_id)
}
async function sendRevision() {
  if (!pendingApproval.value || !chatInput.value.trim()) return
  acting.value = true
  const instruction = chatInput.value.trim()
  try {
    const manual = scriptHandoff.value || pendingApproval.value.approval_stage === 'images'
    const paused = await agentAPI.reject(pendingApproval.value.id, instruction)
    activeRun.value = paused.dry_run || manual ? paused : await agentAPI.resume(paused.id)
    chatInput.value = ''
    await loadRuns()
    ElMessage.success(paused.dry_run || manual ? '修改要求已记录；请在制作页修改后恢复审核' : '修改要求已发送，AI 正在重新生成当前阶段')
  } finally { acting.value = false }
}
function newCreation() { router.push('/create') }
async function returnToRun() { if (route.query.run) await selectRun(String(route.query.run))
  else if (runs.value.length) await selectRun(runs.value[0].id) }
function handleGlobalKeydown(event) {
  if (event.key === 'Escape' && !activeRun.value && runs.value.length && !planVisible.value && !rejectVisible.value) returnToRun()
}

onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKeydown)
  providerStatus.value = await agentAPI.providerStatus()
  if (!providerOperationalReady.value) form.dry_run = true
  await loadRuns()
  if (route.query.run) await selectRun(String(route.query.run))
  else if (runs.value.length) await selectRun(runs.value[0].id)
  pollTimer = window.setInterval(refreshActive, 4000)
})
onBeforeUnmount(() => {
  window.clearInterval(pollTimer)
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<style scoped>
.workbench-shell { min-height: 100vh; background: #0b0a10; color: #f6f4ff; --purple: #7c5cff; --panel: #14131b; --line: #292634; --muted: #9691a3; }
.topbar { position: fixed; inset: 0 0 auto 0; height: 68px; z-index: 20; display: flex; align-items: center; border-bottom: 1px solid var(--line); background: rgba(11,10,16,.88); backdrop-filter: blur(18px); }
.brand { width: 254px; height: 100%; display: flex; align-items: center; gap: 11px; padding: 0 24px; color: inherit; background: none; border: 0; border-right: 1px solid var(--line); cursor: pointer; text-align: left; }
.brand-mark { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 10px; color: white; background: linear-gradient(135deg,#8f72ff,#5a36e8); box-shadow: 0 8px 24px rgba(124,92,255,.32); }
.brand b { display: block; font-size: 16px; letter-spacing: .2px; }.brand small { display: block; margin-top: 2px; color: #7e798b; font-size: 9px; text-transform: uppercase; letter-spacing: 1.1px; }
.topbar-center { flex: 1; display: flex; justify-content: center; align-items: center; gap: 9px; color: #aaa5b6; font-size: 12px; }.live-dot { width: 7px; height: 7px; border-radius: 50%; background: #35d79f; box-shadow: 0 0 9px #35d79f; }.divider { width: 1px; height: 14px; background: var(--line); margin: 0 4px; }
.topbar-actions { min-width: 254px; display: flex; justify-content: flex-end; align-items: center; gap: 5px; padding-right: 22px; }.avatar { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 50%; margin-left: 5px; background: #302b44; color: #c9bfff; font-size: 12px; }
.sidebar { position: fixed; top: 68px; bottom: 0; left: 0; width: 254px; z-index: 10; padding: 22px 14px; border-right: 1px solid var(--line); background: #0e0d13; display: flex; flex-direction: column; }
.sidebar nav { display: grid; gap: 5px; }.nav-item { width: 100%; height: 44px; padding: 0 14px; border: 0; border-radius: 10px; background: transparent; color: #878291; display: flex; align-items: center; gap: 12px; cursor: pointer; font-size: 13px; }.nav-item:hover { background: #191720; color: #d8d3e2; }.nav-item.active { color: #dcd4ff; background: linear-gradient(90deg,rgba(124,92,255,.2),rgba(124,92,255,.06)); box-shadow: inset 2px 0 #8c70ff; }.nav-badge { margin-left: auto; min-width: 18px; height: 18px; display: grid; place-items: center; border-radius: 9px; font-style: normal; background: #7c5cff; color: white; font-size: 10px; }
.sidebar-section { margin-top: 28px; border-top: 1px solid #201e27; padding-top: 20px; }.sidebar-section>p { padding: 0 12px; margin: 0 0 10px; color: #5f5a69; font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px; }.recent-run { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border: 0; border-radius: 9px; background: transparent; color: inherit; text-align: left; cursor: pointer; }.recent-run:hover,.recent-run.selected { background: #191720; }.recent-icon { width: 28px; height: 28px; border-radius: 7px; display: grid; place-items: center; background: #24212e; color: #9a82ff; }.recent-run b,.recent-run small { display: block; max-width: 154px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }.recent-run b { font-size: 11px; font-weight: 550; }.recent-run small { margin-top: 3px; color: #777180; font-size: 9px; }.empty-runs { padding: 12px; color: #5e5966; font-size: 11px; }
.safe-card { margin-top: auto; display: flex; gap: 10px; padding: 13px; border: 1px solid rgba(62,218,160,.16); border-radius: 10px; color: #4fd9a4; background: rgba(47,184,133,.06); }.safe-card b,.safe-card small { display: block; }.safe-card b { font-size: 11px; }.safe-card small { color: #71867e; font-size: 9px; line-height: 1.5; margin-top: 3px; }
.safe-card.real { border-color: rgba(124,92,255,.28); color: #a995ff; background: rgba(124,92,255,.08); }.safe-card.real small { color: #807694; }
.workspace { min-height: 100vh; padding: 68px 0 0 254px; background-image: radial-gradient(circle at 55% 0%,rgba(98,69,182,.12),transparent 30%),linear-gradient(rgba(255,255,255,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.015) 1px,transparent 1px); background-size: auto,32px 32px,32px 32px; }
.creation-view { max-width: 960px; margin: 0 auto; padding: 88px 34px 56px; }.eyebrow { display: flex; justify-content: center; align-items: center; gap: 9px; color: #9c88ff; font-size: 10px; letter-spacing: 2.3px; }.eyebrow span { width: 20px; height: 1px; background: #7c5cff; }.creation-view>h1 { margin: 18px 0 14px; text-align: center; font-size: clamp(38px,5vw,61px); line-height: 1.08; letter-spacing: -2.5px; font-weight: 650; }.creation-view>h1 em { color: #a993ff; font-style: normal; }.hero-copy { max-width: 590px; margin: 0 auto 38px; color: #918b9b; text-align: center; line-height: 1.75; font-size: 14px; }
.prompt-card { border: 1px solid #302d3b; border-radius: 18px; padding: 24px; background: linear-gradient(145deg,rgba(27,24,37,.98),rgba(17,16,23,.98)); box-shadow: 0 30px 80px rgba(0,0,0,.34),0 0 0 1px rgba(124,92,255,.04); }.prompt-heading { display: flex; align-items: center; gap: 12px; margin-bottom: 17px; }.director-avatar { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 11px; background: #322754; color: #bbaaff; font-weight: 600; }.prompt-heading b,.prompt-heading small { display: block; }.prompt-heading b { font-size: 13px; }.prompt-heading small { margin-top: 4px; color: #756f7d; font-size: 10px; }.mock-pill { margin-left: auto; padding: 5px 8px; border: 1px solid rgba(72,218,163,.3); border-radius: 5px; color: #52dba8; background: rgba(72,218,163,.07); font-size: 8px; letter-spacing: 1.2px; }
.prompt-card :deep(.el-textarea__inner) { padding: 16px; border: 1px solid #34303f; border-radius: 10px; box-shadow: none; background: #100f15; color: #ece8f2; line-height: 1.75; font-size: 13px; }.quick-tags { display: flex; align-items: center; gap: 8px; margin: 12px 0 22px; color: #6f6978; font-size: 10px; }.quick-tags button { padding: 5px 9px; border: 1px solid #322e3b; border-radius: 6px; background: #1a1820; color: #9b94a5; font-size: 9px; cursor: pointer; }.quick-tags button:hover { border-color: #665495; color: #c4b8ea; }
.mock-pill.real { border-color: rgba(124,92,255,.45); color: #b29fff; background: rgba(124,92,255,.12); }.mode-selector { display: flex; justify-content: space-between; align-items: center; gap: 18px; margin-bottom: 14px; padding: 12px 14px; border: 1px solid #302d3b; border-radius: 10px; background: #111016; }.mode-selector b,.mode-selector small { display: block; }.mode-selector b { font-size: 11px; }.mode-selector small { margin-top: 3px; color: #716b79; font-size: 9px; }.provider-strip { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; padding: 10px 12px; border: 1px solid rgba(237,173,76,.25); border-radius: 9px; background: rgba(237,173,76,.06); }.provider-strip>span { display: flex; align-items: center; gap: 5px; margin-right: 3px; color: #e5ad5d; font-size: 9px; font-weight: 600; }.provider-strip.ready { border-color: rgba(62,218,160,.18); background: rgba(47,184,133,.05); }.provider-strip.ready>span { color: #4fd9a4; }.provider-strip i { padding: 4px 6px; border-radius: 5px; color: #8f8998; background: #1d1a24; font-size: 8px; font-style: normal; }.provider-strip i.optional { color: #77707f; }.provider-strip i.missing,.provider-strip i.failing { color: #d69a53; }.provider-strip button { margin-left: auto; border: 0; background: none; color: #aa91ff; font-size: 9px; cursor: pointer; }
.form-grid { display: grid; grid-template-columns: repeat(5,1fr); gap: 12px; padding-top: 19px; border-top: 1px solid #27242f; }.form-grid label { color: #8b8594; font-size: 10px; }.form-grid :deep(.el-select),.form-grid :deep(.el-input-number) { width: 100%; margin-top: 8px; }.form-grid :deep(.el-input__wrapper) { min-height: 36px; background: #131219; box-shadow: 0 0 0 1px #302d38 inset; }.prompt-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 24px; }.prompt-footer .el-button { min-width: 190px; border: 0; background: linear-gradient(135deg,#8063f6,#6342d8); box-shadow: 0 10px 28px rgba(96,65,211,.25); }
.promise-row { display: grid; grid-template-columns: repeat(3,1fr); margin-top: 26px; }.promise-row>div { display: flex; justify-content: center; align-items: center; gap: 11px; color: #5f5969; border-right: 1px solid #26232e; }.promise-row>div:last-child { border: 0; }.promise-row .el-icon { color: #8068dc; }.promise-row b,.promise-row small { display: block; }.promise-row b { color: #8c8697; font-size: 10px; }.promise-row small { margin-top: 3px; font-size: 9px; }
.run-view { max-width: 1370px; margin: 0 auto; padding: 36px 34px 60px; }.run-heading { display: flex; justify-content: space-between; gap: 30px; margin-bottom: 25px; }.back-link { padding: 0; border: 0; background: none; color: #7e7789; font-size: 10px; cursor: pointer; }.title-line { display: flex; align-items: center; gap: 12px; margin-top: 9px; }.title-line h1 { margin: 0; font-size: 28px; letter-spacing: -.8px; }.run-heading p { max-width: 760px; margin: 8px 0 0; color: #817b8a; font-size: 12px; }.status-chip { padding: 5px 9px; border-radius: 6px; font-size: 9px; }.status-chip.active { color: #b9aaff; background: rgba(124,92,255,.14); border: 1px solid rgba(124,92,255,.3); }.status-chip.success { color: #56d9a9; background: rgba(60,211,155,.1); }.status-chip.muted { color: #aaa3b2; background: #26232d; }.run-actions { display: flex; align-items: center; gap: 7px; }
.metrics-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 16px; }.metrics-grid article { display: flex; align-items: center; gap: 13px; padding: 17px; border: 1px solid #292631; border-radius: 12px; background: rgba(20,19,27,.9); }.metric-icon { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 9px; }.metric-icon.purple { color: #a995ff; background: rgba(124,92,255,.12); }.metric-icon.blue { color: #6ab9ff; background: rgba(56,148,232,.1); }.metric-icon.green { color: #54d7a7; background: rgba(61,205,151,.1); }.metric-icon.orange { color: #f2a65d; background: rgba(232,146,56,.1); }.metrics-grid small,.metrics-grid b { display: block; }.metrics-grid small { color: #716b79; font-size: 9px; }.metrics-grid b { margin-top: 5px; font-size: 16px; }.metrics-grid b i { color: #655f6d; font-size: 11px; font-style: normal; font-weight: 400; }
.run-layout { display: grid; grid-template-columns: minmax(0,1fr) 326px; gap: 16px; }.main-column,.right-column { display: grid; align-content: start; gap: 16px; }.panel { border: 1px solid #2a2733; border-radius: 13px; background: rgba(19,18,25,.95); overflow: hidden; }.panel-title { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px; border-bottom: 1px solid #27242f; }.panel-title>div { display: flex; align-items: center; gap: 11px; }.panel-title b,.panel-title small { display: block; }.panel-title b { font-size: 12px; }.panel-title small { margin-top: 3px; color: #6e6877; font-size: 9px; }.panel-title.compact { padding: 15px 16px; }.title-icon { width: 29px; height: 29px; display: grid; place-items: center; border-radius: 7px; color: #9e88ff; background: rgba(124,92,255,.1); }.progress-number { color: #9d89f6; font-size: 11px; }.pipeline-progress { height: 2px; background: #201d27; }.pipeline-progress span { display: block; height: 100%; background: linear-gradient(90deg,#7658ed,#aa8dff); transition: width .4s; }
.stage-list { padding: 8px 20px 14px; }.stage-row { position: relative; display: grid; grid-template-columns: 34px minmax(0,1fr) auto; align-items: center; gap: 12px; min-height: 72px; border-bottom: 1px solid #25222d; }.stage-row:last-child { border: 0; }.stage-index { width: 27px; height: 27px; display: grid; place-items: center; border: 1px solid #393541; border-radius: 50%; color: #716b79; font-size: 10px; }.stage-row.done .stage-index { border-color: rgba(70,207,157,.3); color: #52d6a4; background: rgba(57,195,144,.08); }.stage-row.active .stage-index { border-color: #775bec; color: white; background: #7153e4; box-shadow: 0 0 18px rgba(113,83,228,.3); }.stage-copy b,.stage-copy small { display: block; }.stage-copy b { color: #c8c3ce; font-size: 11px; }.stage-copy small { margin-top: 5px; color: #686270; font-size: 9px; }.stage-row.pending .stage-copy { opacity: .55; }.stage-meta { text-align: right; }.stage-meta span,.stage-meta i { display: block; }.stage-meta span { color: #6f6877; font-size: 9px; }.stage-meta i { margin-top: 5px; color: #8f79e7; font-size: 8px; font-style: normal; }.stage-row.done .stage-meta i { color: #4cca9a; }
.episode-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; padding: 16px; }.episode-card-mini { min-height: 142px; padding: 15px; border: 1px solid #292631; border-radius: 10px; background: #111016; }.episode-card-mini>span { color: #8e76ee; font-size: 8px; letter-spacing: 1px; }.episode-card-mini b { display: block; margin-top: 8px; font-size: 11px; }.episode-card-mini p { min-height: 42px; color: #77717f; font-size: 9px; line-height: 1.6; }.episode-card-mini small { color: #56505d; font-size: 8px; }
.approval-panel { padding-bottom: 15px; }.approval-panel.attention { border-color: rgba(124,92,255,.38); box-shadow: 0 10px 40px rgba(60,39,125,.12); }.approval-panel>h3,.approval-panel>p,.approval-panel>.approval-kicker,.approval-panel>.approval-preview,.approval-panel>.el-button,.approval-note { margin-left: 16px; margin-right: 16px; }.approval-kicker { display: flex; align-items: center; gap: 7px; margin-top: 16px; color: #a993ff; font-size: 8px; letter-spacing: 1px; text-transform: uppercase; }.approval-kicker span { width: 6px; height: 6px; border-radius: 50%; background: #8d70ff; box-shadow: 0 0 8px #8d70ff; }.approval-panel h3 { margin-top: 10px; margin-bottom: 7px; font-size: 14px; }.approval-panel>p { color: #77717e; font-size: 9px; line-height: 1.65; }.approval-preview { display: flex; align-items: center; gap: 10px; padding: 11px; border: 1px solid #302c3b; border-radius: 8px; background: #111016; }.approval-preview>span { width: 29px; height: 29px; display: grid; place-items: center; border-radius: 7px; color: #9b86f4; background: #27213b; }.approval-preview b,.approval-preview small { display: block; }.approval-preview b { font-size: 10px; }.approval-preview small { margin-top: 4px; color: #67616e; font-size: 8px; }.approval-panel>.el-button { width: calc(100% - 32px); margin-top: 9px; }.approval-note { display: flex; justify-content: center; align-items: center; gap: 5px; margin-top: 11px; color: #5d5765; font-size: 8px; }.approval-empty { padding: 28px 18px 18px; text-align: center; }.approval-empty>span { display: grid; place-items: center; width: 42px; height: 42px; margin: 0 auto 10px; border-radius: 50%; background: rgba(54,205,149,.1); color: #4fd7a4; font-size: 20px; }.approval-empty b { font-size: 11px; }.approval-empty p { color: #686270; font-size: 9px; }
.approval-preview { width: calc(100% - 32px); color: inherit; text-align: left; cursor: pointer; transition: border-color .2s, transform .2s, background .2s; }
.approval-preview:hover { border-color: #7c5cff; background: #181521; transform: translateY(-1px); }
.approval-preview>div { min-width: 0; flex: 1; }.preview-arrow { color: #8f79e7; }
.panel.focused { border-color: #7c5cff; box-shadow: 0 0 0 3px rgba(124,92,255,.12),0 16px 44px rgba(50,32,108,.16); }
.pipeline-panel,.approval-panel,.budget-panel { scroll-margin-top: 100px; }
.creation-view { position: relative; }.creation-close { position: absolute; top: 28px; right: 34px; display: flex; align-items: center; gap: 6px; padding: 8px 12px; border: 1px solid #363141; border-radius: 9px; color: #c8c1d2; background: #18161f; cursor: pointer; }.creation-close:hover { border-color: #7c5cff; color: white; }
.agent-chat-panel { padding-bottom: 14px; }.chat-history { display: grid; gap: 10px; max-height: 230px; overflow: auto; padding: 14px 16px 8px; }.chat-message { display: flex; align-items: flex-start; gap: 8px; }.chat-message>span { flex: 0 0 26px; height: 26px; display: grid; place-items: center; border-radius: 8px; background: #302754; color: #c8bbff; font-size: 9px; font-weight: 700; }.chat-message.user { flex-direction: row-reverse; }.chat-message.user>span { background: #275b4c; color: #aef1d6; }.chat-message p { margin: 0; padding: 9px 10px; border-radius: 4px 10px 10px 10px; background: #1a1821; color: #c5bfce; font-size: 10px; line-height: 1.55; }.chat-message.user p { border-radius: 10px 4px 10px 10px; background: #22202b; }.chat-suggestions { display: flex; gap: 6px; padding: 6px 16px 10px; overflow-x: auto; }.chat-suggestions button { flex: none; padding: 6px 8px; border: 1px solid #393344; border-radius: 999px; color: #b6a8eb; background: transparent; font-size: 9px; cursor: pointer; }.chat-suggestions button:hover { border-color: #7c5cff; background: rgba(124,92,255,.08); }.agent-chat-panel :deep(.el-textarea) { display: block; width: auto; margin: 0 16px; }.agent-chat-panel :deep(.el-textarea__inner) { background: #111016; color: #eeeaf5; box-shadow: 0 0 0 1px #35313e inset; }.chat-actions { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 16px 0; }.chat-actions small { color: #8e8798; font-size: 9px; }
.budget-panel,.qc-panel { padding-bottom: 15px; }.budget-row { display: flex; justify-content: space-between; padding: 15px 16px 9px; color: #746e7c; font-size: 9px; }.budget-row b { color: #d4cfda; font-size: 11px; }.budget-row i { color: #655f6d; font-style: normal; font-weight: 400; }.budget-panel :deep(.el-progress) { margin: 0 16px; }.budget-stats { display: grid; grid-template-columns: 1fr 1fr; margin: 13px 16px; }.budget-stats span { border-right: 1px solid #292631; }.budget-stats span:last-child { padding-left: 13px; border: 0; }.budget-stats small,.budget-stats b { display: block; }.budget-stats small { color: #625c69; font-size: 8px; }.budget-stats b { margin-top: 4px; font-size: 11px; }.budget-safe { display: flex; align-items: center; gap: 6px; margin: 0 16px; padding: 8px; border-radius: 6px; color: #45c996; background: rgba(57,195,144,.06); font-size: 8px; }.qc-score { display: flex; align-items: end; gap: 8px; padding: 14px 16px 8px; }.qc-score strong { color: #4fd7a4; font-size: 32px; }.qc-score span { color: #635d6b; font-size: 8px; line-height: 1.4; }.qc-score b { color: #54cca0; font-size: 8px; }.qc-tags { display: flex; gap: 5px; padding: 4px 16px; flex-wrap: wrap; }.qc-tags span { padding: 4px 6px; border-radius: 4px; color: #6fc9a8; background: rgba(56,190,140,.07); font-size: 8px; }
.plan-dialog .plan-hero { padding: 18px; border-radius: 12px; background: linear-gradient(135deg,rgba(124,92,255,.16),rgba(124,92,255,.04)); }.plan-hero>span { color: #a590ff; font-size: 9px; letter-spacing: 1.3px; }.plan-hero h2 { margin: 8px 0; }.plan-hero p { margin: 0; color: var(--text-muted); font-size: 12px; }.plan-hero small { display: block; margin-top: 10px; color: #a590ff; font-size: 10px; }.plan-numbers { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin: 14px 0; }.plan-numbers>div { padding: 13px; border: 1px solid var(--border-color); border-radius: 9px; text-align: center; }.plan-numbers b,.plan-numbers small { display: block; }.plan-numbers b { font-size: 19px; }.plan-numbers small { margin-top: 4px; color: var(--text-muted); font-size: 10px; }.plan-dialog h4 { margin: 20px 0 9px; }.plan-episodes { display: grid; gap: 7px; }.plan-episodes>div { display: grid; grid-template-columns: 30px 180px 1fr; align-items: center; gap: 8px; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; }.plan-episodes span { color: #8d72f0; font-size: 10px; }.plan-episodes b { font-size: 11px; }.plan-episodes p { margin: 0; color: var(--text-muted); font-size: 10px; }.gate-row { display: flex; gap: 8px; margin-top: 15px; }.gate-row span { display: flex; align-items: center; gap: 5px; padding: 7px 9px; border-radius: 6px; color: #4dcc9c; background: rgba(53,198,144,.08); font-size: 9px; }.reject-hint { color: var(--text-muted); font-size: 12px; }
html.light .workbench-shell { background: #f5f6fa; color: #202331; --panel:#fff; --line:#dfe2e9; --muted:#626979; }.light .topbar,.light .sidebar { background: rgba(255,255,255,.96); }.light .workspace { background-color: #f5f6fa; background-image: radial-gradient(circle at 55% 0%,rgba(105,76,195,.08),transparent 32%),linear-gradient(rgba(32,35,49,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(32,35,49,.025) 1px,transparent 1px); }.light .panel,.light .metrics-grid article,.light .prompt-card { background: rgba(255,255,255,.98); border-color: #dfe2e9; box-shadow: 0 8px 24px rgba(40,35,70,.045); }.light .prompt-card :deep(.el-textarea__inner),.light .form-grid :deep(.el-input__wrapper),.light .episode-card-mini,.light .approval-preview,.light .agent-chat-panel :deep(.el-textarea__inner) { background: #f8f9fc; color: #202331; }.light .title-line h1,.light .creation-view>h1 { color: #1f2230; }
.light .brand small,.light .topbar-center { color: #5e6575; }.light .nav-item { color: #4f5667; }.light .nav-item:hover { color: #292d3a; }.light .nav-item.active { color: #5b3dc5; background: #eeeafd !important; }.light .sidebar-section>p { color: #687081; }.light .recent-run:hover,.light .recent-run.selected { color: #202331; background: #eceaf4; }.light .recent-icon { background: #e9e5f7; color: #684bd1; }.light .recent-run small { color: #606777; }.light .safe-card.real { color: #6243cc; background: #f0edff; }.light .safe-card.real small { color: #656c7b; }
.light .hero-copy,.light .prompt-heading small,.light .mode-selector small,.light .run-heading p { color: #626979; }.light .mode-selector { border-color: #dfe2e9; background: #f4f5f8; }.light .provider-strip i { color: #4f5665; background: #ebeaf0; }.light .quick-tags { color: #626979; }.light .quick-tags button { border-color: #d9dce4; background: #f2f3f7; color: #4e5565; }.light .form-grid { border-color: #dfe2e9; }.light .form-grid label { color: #555d6d; }.light .promise-row>div { color: #606777; border-color: #dfe2e9; }.light .promise-row b { color: #3c4250; }
.light .back-link { color: #555d6d; }.light .metrics-grid small,.light .metrics-grid b i { color: #5e6575; }.light .panel-title { border-color: #e0e3e9; }.light .panel-title small { color: #626979; }.light .stage-row { border-color: #e2e4ea; }.light .stage-copy b { color: #333846; }.light .stage-copy small,.light .stage-meta span { color: #606777; }.light .stage-row.pending .stage-copy { opacity: .78; }.light .episode-card-mini { border-color: #dfe2e9; }.light .episode-card-mini p,.light .episode-card-mini small { color: #596171; }.light .approval-panel>p,.light .approval-preview small,.light .approval-note,.light .approval-empty p { color: #5d6474; }.light .approval-preview:hover { background: #f3f0ff; }.light .budget-row,.light .budget-row i,.light .budget-stats small { color: #5c6373; }.light .chat-message p { color: #343947; background: #f0f1f5; }.light .chat-message.user p { background: #ede9fa; }.light .chat-suggestions button { border-color: #d7d2e5; color: #5f45bd; }.light .chat-actions small { color: #626979; }.light .creation-close { border-color: #d9dce4; color: #414858; background: white; }
.light .progress-number,.light .stage-meta i { color: #6040c5; }.light .stage-row.done .stage-meta i { color: #087f5b; }.light .stage-row.pending .stage-copy { opacity: 1; }.light .stage-row.pending .stage-copy small { color: #555d6d; }.light .episode-card-mini>span { color: #6040c5; }
:global(html.dark) .brand small,:global(html.dark) .topbar-center,:global(html.dark) .sidebar-section>p,:global(html.dark) .recent-run small,:global(html.dark) .safe-card small,:global(html.dark) .prompt-heading small,:global(html.dark) .mode-selector small,:global(html.dark) .hero-copy,:global(html.dark) .run-heading p,:global(html.dark) .metrics-grid small,:global(html.dark) .panel-title small,:global(html.dark) .stage-copy small,:global(html.dark) .stage-meta span,:global(html.dark) .episode-card-mini p,:global(html.dark) .episode-card-mini small,:global(html.dark) .approval-panel>p,:global(html.dark) .approval-preview small,:global(html.dark) .approval-note,:global(html.dark) .budget-row,:global(html.dark) .budget-row i,:global(html.dark) .budget-stats small { color: #aaa4b4; }
:global(html.dark) .nav-item { color: #b1abb9; }:global(html.dark) .recent-run b,:global(html.dark) .stage-copy b { color: #e3dee8; }
.approval-kicker,.approval-preview small,.approval-note,.budget-stats small,.budget-safe,.qc-score span,.qc-score b,.qc-tags span,.episode-card-mini>span,.episode-card-mini small { font-size: 10px; }.approval-panel>p,.approval-preview b,.stage-copy b,.stage-copy small,.stage-meta span,.stage-meta i,.panel-title small,.metrics-grid small,.recent-run small { font-size: 11px; }
@media (max-width: 1120px) { .sidebar { width: 76px; }.brand { width: 76px; padding: 0 20px; }.brand>span:last-child,.nav-item span,.nav-badge,.sidebar-section,.safe-card { display: none; }.topbar-center { justify-content: flex-start; padding-left: 16px; }.workspace { padding-left: 76px; }.form-grid { grid-template-columns: repeat(3,1fr); }.metrics-grid { grid-template-columns: repeat(2,1fr); } }
@media (max-width: 820px) { .topbar-center { display: none; }.topbar-actions { min-width: 0; flex: 1; }.sidebar { display: none; }.workspace { padding-left: 0; }.creation-view,.run-view { padding-left: 18px; padding-right: 18px; }.form-grid { grid-template-columns: 1fr 1fr; }.run-layout { grid-template-columns: 1fr; }.episode-grid { grid-template-columns: 1fr; }.run-heading { display: block; }.run-actions { margin-top: 16px; }.promise-row { display: none; } }
</style>

<style scoped>
.review-cycle-panel { padding:16px; } .review-cycle-panel p { font-size:13px; line-height:1.7; } .review-cycle-panel details { padding:10px 0; border-top:1px solid #8884; } .review-cycle-panel pre { white-space:pre-wrap; overflow-wrap:anywhere; font:inherit; }
</style>

<style scoped>.image-gate-grid{padding:16px;max-height:480px;overflow:auto}.image-gate-grid figure{margin:0 0 16px}.image-gate-grid img{width:100%;max-height:320px;object-fit:contain}.image-gate-grid figcaption{font-size:12px;line-height:1.6}</style>
