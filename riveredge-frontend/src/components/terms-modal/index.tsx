/**
 * 条款弹窗组件
 *
 * 用于显示用户条款和隐私条款内容
 */

import { Modal, Typography, Divider } from 'antd';

const { Title, Paragraph } = Typography;

/**
 * 条款类型
 */
export type TermsType = 'user' | 'privacy';

/**
 * 条款弹窗组件属性
 */
interface TermsModalProps {
  /**
   * 是否显示弹窗
   */
  open: boolean;

  /**
   * 条款类型（用户条款或隐私条款）
   */
  type: TermsType;

  /**
   * 关闭弹窗的回调函数
   */
  onClose: () => void;
}

/**
 * 用户条款内容（与 Apache 2.0 开源许可及多组织 SaaS 场景对齐）
 */
const UserTermsContent = () => (
  <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '0 8px' }}>
    <Title level={4}>用户服务协议</Title>
    <Paragraph>
      欢迎使用 RiverEdge（以下简称&quot;本项目&quot;或&quot;本软件&quot;）。本用户服务协议（以下简称&quot;本协议&quot;）约定您与 RiverEdge 相关权利人之间，就使用本软件及（如适用）我们运营的在线服务的权利义务。
    </Paragraph>
    <Paragraph>
      当您点击&quot;同意&quot;、注册、登录或开始使用时，即表示您已阅读、理解并同意接受本协议。若您代表组织使用，您保证已获得该组织授权，并使该组织受本协议约束。
    </Paragraph>
    <Paragraph>
      本项目开源软件以 Apache License, Version 2.0（以下简称&quot;Apache 2.0&quot;）发布。若本协议与 Apache 2.0 就开源软件的授权范围冲突，就该开源软件部分以 Apache 2.0 为准；就我们运营的在线服务（SaaS）、品牌与您的业务数据，以本协议及相关专项约定为准。
    </Paragraph>

    <Divider />

    <Title level={5}>一、定义与适用范围</Title>
    <Paragraph>
      1.1 &quot;开源软件&quot;：指以 Apache 2.0 发布的 RiverEdge 源代码、文档及随附材料，完整许可见项目仓库 LICENSE，或 https://www.apache.org/licenses/LICENSE-2.0 。
    </Paragraph>
    <Paragraph>
      1.2 &quot;在线服务&quot;：指由我们或经授权方部署并运营、供您通过网络访问的 RiverEdge 多组织管理服务（如适用），功能可包括用户与组织管理、权限、业务单据、文件与集成等，以实际开通范围为准。
    </Paragraph>
    <Paragraph>
      1.3 &quot;您&quot;：指注册、登录或使用开源软件/在线服务的个人，或该个人所代表的组织。
    </Paragraph>
    <Paragraph>
      1.4 若您仅自行部署开源软件、且不使用我们运营的在线服务，则本协议中关于在线服务运营、账户开通与服务终止等条款不适用；开源使用仍须遵守 Apache 2.0。
    </Paragraph>

    <Divider />

    <Title level={5}>二、服务说明</Title>
    <Paragraph>
      2.1 在线服务面向多组织场景，具体功能、配额与可用性以您实际开通的环境及届时公示说明为准。我们可能持续迭代功能，重大变更将尽量提前告知。
    </Paragraph>
    <Paragraph>
      2.2 为保障安全与稳定，我们可能进行维护、升级或临时中断。计划内维护将尽量提前公示；紧急安全处置可能无法事先通知。
    </Paragraph>
    <Paragraph>
      2.3 我们不对第三方系统、网络、浏览器或您本地环境导致的不可用作出承诺。依赖第三方连接器（如对象存储、即时通讯等）时，还需遵守对应第三方条款。
    </Paragraph>

    <Divider />

    <Title level={5}>三、账户与组织</Title>
    <Paragraph>
      3.1 使用在线服务通常需要账户。您应提供真实、准确、完整且可及时更新的注册与联系信息。
    </Paragraph>
    <Paragraph>
      3.2 您应妥善保管账号与凭证，对以您账户实施的操作负责。发现盗用或异常，请立即采取措施并通知我们。
    </Paragraph>
    <Paragraph>
      3.3 不得出售、出租账户，或将账户提供给无权使用的第三方。组织管理员应合理配置权限与数据范围，并对其组织内用户行为承担管理责任。
    </Paragraph>
    <Paragraph>
      3.4 您保证有权上传、处理相关业务数据，且该等处理不违反适用法律或第三方权利。
    </Paragraph>

    <Divider />

    <Title level={5}>四、使用规范</Title>
    <Paragraph>
      4.1 您应遵守适用法律法规及本协议，不得将开源软件或在线服务用于违法违规目的。
    </Paragraph>
    <Paragraph>
      4.2 使用在线服务时，禁止下列行为：
    </Paragraph>
    <Paragraph style={{ paddingLeft: 24 }}>
      （1）发布、传播或存储法律、行政法规禁止的内容；<br />
      （2）侵犯他人知识产权、商业秘密、隐私权等合法权益；<br />
      （3）攻击、侵入、干扰服务或未经授权扫描、探测系统；<br />
      （4）未经授权访问、爬取、篡改或删除他人或他组织数据；<br />
      （5）规避、破坏安全或权限控制机制，或滥用接口造成不合理负载；<br />
      （6）其他违反法律法规、公序良俗或本协议的行为。
    </Paragraph>
    <Paragraph>
      4.3 对开源软件的使用、修改与再分发，须同时遵守 Apache 2.0（包括保留许可与版权声明、NOTICE 要求等，如适用）。本条不限制 Apache 2.0 已明确授予的权利。
    </Paragraph>

    <Divider />

    <Title level={5}>五、知识产权与开源许可</Title>
    <Paragraph>
      5.1 开源软件的著作权等权利由贡献者及权利人依 Apache 2.0 及适用法律享有。您可在遵守 Apache 2.0 的前提下使用、复制、修改、再分发开源软件（含源码与目标码形式）。
    </Paragraph>
    <Paragraph>
      5.2 Apache 2.0 不授予商标权。&quot;RiverEdge&quot;名称、标识、徽标及其他品牌元素的权利仍归权利人所有。未经书面许可，不得暗示我们背书、赞助或与您的产品/服务存在关联。
    </Paragraph>
    <Paragraph>
      5.3 使用在线服务时，您获得的是在服务期内访问与使用该服务的权利；这不改变开源软件的 Apache 2.0 授权，也不将您的业务数据转让给我们。
    </Paragraph>
    <Paragraph>
      5.4 您上传或产生的业务数据，权利归属按您与组织之间的约定及适用法律确定。除为提供、维护、保障安全与改进服务所必需，或依法/依有权机关要求外，我们不主张该等数据的知识产权归我们所有。
    </Paragraph>
    <Paragraph>
      5.5 第三方开源组件遵循其各自许可；使用时请一并遵守相应许可条款。
    </Paragraph>

    <Divider />

    <Title level={5}>六、数据与隐私</Title>
    <Paragraph>
      6.1 我们如何收集与处理个人信息，详见《隐私政策》。使用在线服务即表示您亦知悉该政策。
    </Paragraph>
    <Paragraph>
      6.2 您应自行做好重要业务数据的备份与导出（在功能支持范围内）。自行部署开源软件时，数据安全与备份由您自行负责。
    </Paragraph>
    <Paragraph>
      6.3 在线服务中，我们可能在合理必要范围内访问运维日志、诊断信息，用于故障排查、安全防护与服务质量改进，并以最小必要为原则。
    </Paragraph>

    <Divider />

    <Title level={5}>七、免责声明与责任限制</Title>
    <Paragraph>
      7.1 按 Apache 2.0，开源软件按&quot;现状&quot;（AS IS）提供，不附带适销性、特定用途适用性及不侵权等明示或暗示担保。
    </Paragraph>
    <Paragraph>
      7.2 在线服务亦按&quot;现状&quot;与&quot;可用&quot;基础提供。在法律允许的最大范围内，我们不对间接损失、利润损失、数据丢失或业务中断承担责任，法律法规另有强制性规定的除外。
    </Paragraph>
    <Paragraph>
      7.3 因不可抗力、基础网络或电力故障、第三方服务中断、您的配置或操作失误、或超出合理控制的事件导致的中断或损失，我们将在能力范围内协助排查，但不因此承担赔偿责任。
    </Paragraph>
    <Paragraph>
      7.4 若适用法律不允许排除或限制某些责任，则我们仅在该法律要求的最小范围内承担责任。
    </Paragraph>

    <Divider />

    <Title level={5}>八、服务变更、暂停与终止</Title>
    <Paragraph>
      8.1 我们可根据产品演进调整在线服务功能。若变更实质影响您的主要使用方式，将尽量提前公示。
    </Paragraph>
    <Paragraph>
      8.2 您可随时停止使用在线服务并申请注销账户（按产品流程办理）。注销后，相关数据将按《隐私政策》与法律要求删除或匿名化处理，法律法规要求保留的除外。
    </Paragraph>
    <Paragraph>
      8.3 若您严重或持续违反本协议，我们可暂停或终止向您提供在线服务，并依法保留相应权利。终止不影响 Apache 2.0 已授予您的开源软件权利（以该许可为准）。
    </Paragraph>

    <Divider />

    <Title level={5}>九、协议修改</Title>
    <Paragraph>
      9.1 我们可能修订本协议。修订后将在本服务相关页面公布，并更新文末日期；重大变更将尽量以合理方式提示。
    </Paragraph>
    <Paragraph>
      9.2 若您在修订生效后继续使用在线服务，即视为接受修订。若您不同意，应停止使用在线服务。开源软件的授权变更仅在符合 Apache 2.0 及适用法律的前提下进行。
    </Paragraph>

    <Divider />

    <Title level={5}>十、适用法律与争议解决</Title>
    <Paragraph>
      10.1 本协议的订立、效力、解释与争议解决，适用中华人民共和国大陆地区法律（冲突法规范除外）。
    </Paragraph>
    <Paragraph>
      10.2 因本协议产生的争议，双方应先行友好协商；协商不成的，提交被告所在地有管辖权的人民法院诉讼解决。
    </Paragraph>

    <Divider />

    <Title level={5}>十一、联系我们</Title>
    <Paragraph>
      如对本协议有疑问或建议，请联系：
    </Paragraph>
    <Paragraph style={{ paddingLeft: 24 }}>
      邮箱：ludingjie@live.cn
    </Paragraph>

    <Divider />

    <Paragraph style={{ textAlign: 'right', color: '#8c8c8c', fontSize: '12px' }}>
      最后更新日期：2026年8月
    </Paragraph>
  </div>
);

/**
 * 隐私条款内容
 */
const PrivacyTermsContent = () => (
  <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '0 8px' }}>
    <Title level={4}>隐私政策</Title>
    <Paragraph>
      RiverEdge SaaS 多组织管理框架（以下简称&quot;我们&quot;）非常重视用户的隐私保护。本隐私政策说明了我们如何收集、使用、存储和保护您的个人信息。请您仔细阅读本隐私政策。
    </Paragraph>

    <Divider />

    <Title level={5}>一、信息收集</Title>
    <Paragraph>
      1.1 我们可能收集以下信息：
    </Paragraph>
    <Paragraph style={{ paddingLeft: 24 }}>
      （1）账户信息：用户名、邮箱地址、密码（加密存储）等；<br />
      （2）使用信息：登录记录、操作日志、IP 地址等；<br />
      （3）设备信息：设备类型、操作系统、浏览器类型等；<br />
      （4）其他信息：您在使用服务过程中主动提供的信息。
    </Paragraph>
    <Paragraph>
      1.2 我们不会收集您的敏感个人信息，除非您主动提供或法律法规要求。
    </Paragraph>

    <Divider />

    <Title level={5}>二、信息使用</Title>
    <Paragraph>
      我们使用收集的信息用于以下目的：
    </Paragraph>
    <Paragraph style={{ paddingLeft: 24 }}>
      （1）提供、维护和改进本服务；<br />
      （2）处理您的注册、登录、使用请求；<br />
      （3）发送服务通知、安全提醒等信息；<br />
      （4）进行数据分析，优化用户体验；<br />
      （5）遵守法律法规要求。
    </Paragraph>

    <Divider />

    <Title level={5}>三、信息存储</Title>
    <Paragraph>
      3.1 我们采用行业标准的安全措施保护您的个人信息，包括数据加密、访问控制等。
    </Paragraph>
    <Paragraph>
      3.2 您的个人信息将存储在中华人民共和国境内。如需跨境传输，我们将遵守相关法律法规。
    </Paragraph>
    <Paragraph>
      3.3 我们仅在为实现本隐私政策所述目的所必需的期间内保留您的个人信息。
    </Paragraph>

    <Divider />

    <Title level={5}>四、信息共享</Title>
    <Paragraph>
      4.1 我们不会向第三方出售、出租或以其他方式披露您的个人信息，除非：
    </Paragraph>
    <Paragraph style={{ paddingLeft: 24 }}>
      （1）获得您的明确同意；<br />
      （2）法律法规要求；<br />
      （3）为提供服务所必需（如云服务提供商）；<br />
      （4）保护我们的合法权益。
    </Paragraph>
    <Paragraph>
      4.2 我们可能与关联公司、合作伙伴共享必要的业务信息，但会要求其遵守本隐私政策。
    </Paragraph>

    <Divider />

    <Title level={5}>五、Cookie 和类似技术</Title>
    <Paragraph>
      5.1 我们使用 Cookie 和类似技术来改善用户体验、分析服务使用情况。
    </Paragraph>
    <Paragraph>
      5.2 您可以通过浏览器设置管理 Cookie，但可能会影响部分功能的使用。
    </Paragraph>

    <Divider />

    <Title level={5}>六、您的权利</Title>
    <Paragraph>
      您对自己的个人信息享有以下权利：
    </Paragraph>
    <Paragraph style={{ paddingLeft: 24 }}>
      （1）访问权：您可以查看我们收集的您的个人信息；<br />
      （2）更正权：您可以更正不准确的个人信息；<br />
      （3）删除权：您可以要求删除您的个人信息；<br />
      （4）撤回同意：您可以撤回对个人信息处理的同意；<br />
      （5）投诉权：您可以向监管部门投诉我们的隐私保护行为。
    </Paragraph>
    <Paragraph>
      如需行使上述权利，请通过本隐私政策末尾的联系方式联系我们。
    </Paragraph>

    <Divider />

    <Title level={5}>七、未成年人保护</Title>
    <Paragraph>
      7.1 我们非常重视未成年人的个人信息保护。
    </Paragraph>
    <Paragraph>
      7.2 如果您是未成年人，请在监护人同意和指导下使用本服务。
    </Paragraph>
    <Paragraph>
      7.3 如果我们发现收集了未成年人的个人信息，将尽快删除相关数据。
    </Paragraph>

    <Divider />

    <Title level={5}>八、隐私政策更新</Title>
    <Paragraph>
      8.1 我们可能随时更新本隐私政策。更新后的隐私政策将在本服务页面公布。
    </Paragraph>
    <Paragraph>
      8.2 重大变更时，我们将通过显著方式通知您。
    </Paragraph>

    <Divider />

    <Title level={5}>九、联系我们</Title>
    <Paragraph>
      如您对本隐私政策有任何疑问、意见或建议，请通过以下方式联系我们：
    </Paragraph>
    <Paragraph style={{ paddingLeft: 24 }}>
      邮箱：ludingjie@live.cn
    </Paragraph>

    <Divider />

    <Paragraph style={{ textAlign: 'right', color: '#8c8c8c', fontSize: '12px' }}>
      最后更新日期：2025年11月
    </Paragraph>
  </div>
);

/**
 * 条款弹窗组件
 */
export default function TermsModal({ open, type, onClose }: TermsModalProps) {
  const title = type === 'user' ? '用户服务协议' : '隐私政策';
  const content = type === 'user' ? <UserTermsContent /> : <PrivacyTermsContent />;

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
      style={{ top: 40 }}
      styles={{ body: { padding: '24px' } }}
    >
      {content}
    </Modal>
  );
}
