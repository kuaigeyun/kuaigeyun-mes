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
 * 用户条款内容
 */
const UserTermsContent = () => (
  <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '0 8px' }}>
    <Title level={4}>用户服务协议</Title>
    <Paragraph>
      欢迎使用 RiverEdge SaaS 多组织管理框架（以下简称"本服务"）。在使用本服务之前，请您仔细阅读本用户服务协议（以下简称"本协议"）。当您点击"同意"或开始使用本服务时，即表示您已充分理解并同意接受本协议的全部内容。
    </Paragraph>

    <Divider />

    <Title level={5}>一、服务说明</Title>
    <Paragraph>
      1.1 本服务是由 RiverEdge 提供的多组织 SaaS 管理平台，为企业提供安全、高效、可扩展的 SaaS 解决方案。
    </Paragraph>
    <Paragraph>
      1.2 本服务包括但不限于：用户管理、组织管理、权限管理、数据管理等核心功能。
    </Paragraph>
    <Paragraph>
      1.3 我们保留随时修改、中断或终止本服务的权利，无需事先通知用户。
    </Paragraph>

    <Divider />

    <Title level={5}>二、用户账户</Title>
    <Paragraph>
      2.1 您需要注册账户才能使用本服务的部分功能。注册时，您需要提供真实、准确、完整的注册信息。
    </Paragraph>
    <Paragraph>
      2.2 您有责任维护账户信息的安全性和准确性。如发现账户被盗用或存在安全漏洞，请立即通知我们。
    </Paragraph>
    <Paragraph>
      2.3 您不得将账户转让、出售或以其他方式提供给第三方使用。
    </Paragraph>

    <Divider />

    <Title level={5}>三、使用规范</Title>
    <Paragraph>
      3.1 您在使用本服务时，应当遵守相关法律法规，不得利用本服务从事违法违规活动。
    </Paragraph>
    <Paragraph>
      3.2 您不得利用本服务进行以下行为：
    </Paragraph>
    <Paragraph style={{ paddingLeft: 24 }}>
      （1）发布、传播、存储含有法律、行政法规禁止的内容；<br />
      （2）侵犯他人知识产权、商业秘密等合法权益；<br />
      （3）干扰、破坏本服务的正常运行；<br />
      （4）未经授权访问、使用或修改本服务的数据；<br />
      （5）其他违反法律法规或本协议的行为。
    </Paragraph>

    <Divider />

    <Title level={5}>四、知识产权</Title>
    <Paragraph>
      4.1 本服务的所有知识产权，包括但不限于商标、专利、著作权等，均归 RiverEdge 所有。
    </Paragraph>
    <Paragraph>
      4.2 未经我们书面许可，您不得复制、修改、传播、展示或以其他方式使用本服务的任何内容。
    </Paragraph>

    <Divider />

    <Title level={5}>五、免责声明</Title>
    <Paragraph>
      5.1 本服务按"现状"提供，我们不对服务的准确性、完整性、及时性、可靠性作任何明示或暗示的保证。
    </Paragraph>
    <Paragraph>
      5.2 因不可抗力、网络故障、系统维护等原因导致的服务中断或数据丢失，我们不承担责任。
    </Paragraph>
    <Paragraph>
      5.3 您使用本服务所产生的风险由您自行承担。
    </Paragraph>

    <Divider />

    <Title level={5}>六、服务变更与终止</Title>
    <Paragraph>
      6.1 我们有权根据业务发展需要，随时修改、中断或终止本服务。
    </Paragraph>
    <Paragraph>
      6.2 如您违反本协议，我们有权立即终止向您提供服务，并保留追究法律责任的权利。
    </Paragraph>

    <Divider />

    <Title level={5}>七、协议修改</Title>
    <Paragraph>
      7.1 我们有权随时修改本协议。修改后的协议将在本服务页面公布，自公布之日起生效。
    </Paragraph>
    <Paragraph>
      7.2 如您不同意修改后的协议，请停止使用本服务。
    </Paragraph>

    <Divider />

    <Title level={5}>八、联系我们</Title>
    <Paragraph>
      如您对本协议有任何疑问，请通过以下方式联系我们：
    </Paragraph>
    <Paragraph style={{ paddingLeft: 24 }}>
      邮箱：support@riveredge.cn
    </Paragraph>

    <Divider />

    <Paragraph style={{ textAlign: 'right', color: '#8c8c8c', fontSize: '12px' }}>
      最后更新日期：2025年11月
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
      RiverEdge SaaS 多组织管理框架（以下简称"我们"）非常重视用户的隐私保护。本隐私政策说明了我们如何收集、使用、存储和保护您的个人信息。请您仔细阅读本隐私政策。
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
      邮箱：privacy@riveredge.cn
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
      style={{ top: 20 }}
      styles={{ body: { padding: '24px' } }}
    >
      {content}
    </Modal>
  );
}
