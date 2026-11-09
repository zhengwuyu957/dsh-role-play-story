/**
 * Host half of the multi-character story bundle.
 *
 * 本插件复用 dsh-role-play 的 Host 路由（/rp-chat/api/*），自身不注册任何路由，
 * 因此这里不需要 llm / webServer 服务。Client 半部通过共享接口拿到角色卡与模型。
 */
export function apply() {}
