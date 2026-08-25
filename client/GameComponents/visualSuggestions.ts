export function getHonorSuggestionClass(honor: number, visualSuggestions: boolean) {
    if(!visualSuggestions) {
        return "";
    }

    if(honor >= 23) {
        return "visual-suggestion visual-suggestion--positive";
    }

    if(honor <= 2) {
        return "visual-suggestion visual-suggestion--negative";
    }

    return "";
}
