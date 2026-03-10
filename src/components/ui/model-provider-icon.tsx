import { BlendIcon } from "lucide-react";
import { GeminiIcon } from "./gemini-icon";


export function ModelProviderIcon({
    provider,
    className

}: {provider:string;className?:string}){
    return provider === "google" ?(
        <GeminiIcon className={className}/>
    ):(
        <BlendIcon className={className}/>
    )
}