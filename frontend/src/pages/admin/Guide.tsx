export default function Guide() {
  const sections = [
    {
      title: "快速开始",
      items: [
        { label: "登录后台", desc: "使用管理员账号密码登录。如需修改密码请联系运维人员。" },
        { label: "配置站点信息", desc: "进入「站点设置」，填写网站标题、项目名称（支持回车换行）、底部版权文字，上传院徽和横幅大图。" },
        { label: "添加内容区块", desc: "进入「内容管理」，点击「+ 新建区块」选择类型，填写内容后保存。前台会按顺序展示所有可见区块。" },
        { label: "查看效果", desc: "点击顶栏「访问前台」按钮在新标签页查看展示效果。" },
      ],
    },
    {
      title: "站点设置",
      items: [
        { label: "网站标题", desc: "显示在浏览器标签页上。" },
        { label: "项目名称", desc: "显示在首页头图区域的大标题。支持回车换行控制断行位置。" },
        { label: "底部版权文字", desc: "显示在页面底部，例如「© 2026 河南医药大学心理学院」。留空则不显示。" },
        { label: "院徽 / 校徽", desc: "显示在首页头图区域。建议使用正方形 PNG 透明底图，推荐 200×200 像素以上。" },
        { label: "横幅大图", desc: "暂未启用，预留功能。" },
        { label: "主题风格", desc: "提供 3 套预设主题：雅致黛蓝（浅色学术风）、青矾素白（医学绿调）、微晓深灰（深色科技风）。点击即时生效。" },
        { label: "字体大小", desc: "标准（16px）、大号（18px）、特大（20px）。所有文字等比缩放，适合投影展示时选择大号或特大。" },
        { label: "主题配色", desc: "在预设主题基础上微调主色、渐变色和强调色。通过颜色选择器设置。" },
      ],
    },
    {
      title: "内容管理",
      items: [
        { label: "新建区块", desc: "点击「+ 新建区块」按钮，在弹窗中选择区块类型，填写标题后进入编辑页面。" },
        { label: "编辑区块", desc: "点击区块卡片进入编辑页，修改标题和内容后点击「保存」。" },
        { label: "区块排序", desc: "使用区块卡片上的上移 ↑ / 下移 ↓ 箭头调整展示顺序。前台按此顺序从上到下显示。" },
        { label: "显示 / 隐藏", desc: "点击区块卡片上的开关控制是否在前台展示。隐藏的区块仍保留数据，随时可恢复显示。" },
        { label: "删除区块", desc: "点击删除按钮并确认后永久删除该区块及其内容。此操作不可撤销。" },
      ],
    },
    {
      title: "5 种区块类型",
      items: [
        { label: "富文本", desc: "适用于成果简介、项目概述等大段图文。支持标题、加粗、列表、插入图片和链接。图片需先在「文件管理」上传后插入。" },
        { label: "图片展示", desc: "适用于团队荣誉证书、教材封面等。可配置每行显示列数和每页数量。支持点击图片全屏预览。" },
        { label: "数据表格", desc: "适用于完成人列表、项目列表、论文列表等结构化数据。先定义列（如姓名、职称），再逐行填写数据。" },
        { label: "外链跳转", desc: "适用于新闻报道等外部链接。每条填写标题、URL 地址、来源和日期。点击后在新标签页打开。" },
        { label: "视频展示", desc: "适用于教学成果视频。支持上传本地视频文件或填写视频直链 URL（.mp4 / .webm 格式）。可上传封面图。" },
      ],
    },
    {
      title: "文件管理",
      items: [
        { label: "上传文件", desc: "支持上传图片（JPG/PNG/GIF/WebP）和视频（MP4/WebM），单文件最大 50MB。" },
        { label: "复制链接", desc: "点击文件卡片可复制文件 URL，用于在富文本编辑器中插入图片。" },
        { label: "删除文件", desc: "如果文件正被某个区块使用，系统会阻止删除并提示「文件正在被使用」。需先移除引用后再删除。" },
        { label: "筛选查看", desc: "顶部标签可按「全部 / 图片 / 视频」筛选查看。" },
      ],
    },
    {
      title: "注意事项",
      items: [
        { label: "数据安全", desc: "所有修改实时保存到数据库。建议定期让运维人员备份服务器上的 data/app.db 文件。" },
        { label: "图片规范", desc: "荣誉证书建议扫描件，分辨率不低于 300dpi。图片展示区域为正方形裁剪，建议使用 1:1 比例的图片。" },
        { label: "视频规范", desc: "建议使用 MP4 格式（H.264 编码），分辨率 1080p，文件大小控制在 50MB 以内。" },
        { label: "浏览器兼容", desc: "推荐使用 Chrome、Edge 或 Firefox 最新版本访问。" },
      ],
    },
  ];

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-slate-800">使用说明</h1>
        <p className="text-slate-500 text-sm mt-1">网站管理操作指南</p>
      </div>

      <div className="space-y-6">
        {sections.map((section, idx) => (
          <div
            key={idx}
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
          >
            <div
              className="px-6 py-4 border-b border-slate-100"
              style={{ background: '#F8FAFC' }}
            >
              <h2 className="font-bold text-slate-700 flex items-center gap-2">
                <span
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-xs text-white font-bold"
                  style={{ background: 'linear-gradient(135deg, #1E3A8A, #3B82F6)' }}
                >
                  {idx + 1}
                </span>
                {section.title}
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {section.items.map((item, i) => (
                <div key={i} className="px-6 py-4 flex gap-4">
                  <div className="shrink-0 mt-0.5">
                    <span className="inline-block w-2 h-2 rounded-full mt-1.5" style={{ background: '#3B82F6' }} />
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">{item.label}</span>
                    <span className="text-slate-500 ml-2">{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
