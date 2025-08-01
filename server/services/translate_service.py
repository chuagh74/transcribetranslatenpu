# server/services/translate_service.py
import logging
from server.config import translator

logger = logging.getLogger(__name__)

# Language code mapping for M2M100 compatibility
LANGUAGE_CODE_MAP = {
    # Common variations to M2M100 supported codes
    'zh_CN': 'zh',
    'zh_TW': 'zh', 
    'zh-cn': 'zh',
    'zh-tw': 'zh',
    'chinese': 'zh',
    'mandarin': 'zh',
    'en_US': 'en',
    'en_GB': 'en',
    'en-us': 'en',
    'en-gb': 'en',
    'english': 'en',
    'fr_FR': 'fr',
    'fr-fr': 'fr',
    'french': 'fr',
    'de_DE': 'de',
    'de-de': 'de',
    'german': 'de',
    'es_ES': 'es',
    'es-es': 'es',
    'spanish': 'es',
    'it_IT': 'it',
    'it-it': 'it',
    'italian': 'it',
    'pt_PT': 'pt',
    'pt_BR': 'pt',
    'pt-pt': 'pt',
    'pt-br': 'pt',
    'portuguese': 'pt',
    'ru_RU': 'ru',
    'ru-ru': 'ru',
    'russian': 'ru',
    'ja_JP': 'ja',
    'ja-jp': 'ja',
    'japanese': 'ja',
    'ko_KR': 'ko',
    'ko-kr': 'ko',
    'korean': 'ko'
}

def normalize_language_code(lang_code: str) -> str:
    """Normalize language code to M2M100 compatible format"""
    if not lang_code:
        return 'en'
    
    # Handle 'auto' detection - default to English for M2M100 compatibility
    # M2M100 doesn't support auto-detection, so we use English as fallback
    if lang_code.lower() == 'auto':
        logger.info("Language 'auto' specified - defaulting to 'en' (M2M100 requires explicit languages)")
        return 'en'
    
    # Convert to lowercase for lookup
    normalized = lang_code.lower()
    
    # Check if direct mapping exists
    if normalized in LANGUAGE_CODE_MAP:
        return LANGUAGE_CODE_MAP[normalized]
    
    # If already a valid M2M100 code, return as-is
    # M2M100 supports: en, zh, fr, de, es, it, pt, ru, ja, ko, etc.
    if normalized in ['en', 'zh', 'fr', 'de', 'es', 'it', 'pt', 'ru', 'ja', 'ko', 
                      'ar', 'hi', 'tr', 'pl', 'nl', 'sv', 'da', 'no', 'fi', 'cs',
                      'hu', 'ro', 'bg', 'hr', 'sk', 'sl', 'et', 'lv', 'lt', 'mt']:
        return normalized
    
    # Extract language part from locale codes (e.g., 'en-US' -> 'en')
    if '-' in normalized:
        base_lang = normalized.split('-')[0]
        if base_lang in ['en', 'zh', 'fr', 'de', 'es', 'it', 'pt', 'ru', 'ja', 'ko']:
            return base_lang
    
    if '_' in normalized:
        base_lang = normalized.split('_')[0]
        if base_lang in ['en', 'zh', 'fr', 'de', 'es', 'it', 'pt', 'ru', 'ja', 'ko']:
            return base_lang
    
    # Default to English if no mapping found
    logger.warning(f"Unknown language code '{lang_code}', defaulting to 'en'")
    return 'en'

def translate_text(text: str, src_lang: str = "en", tgt_lang: str = "en") -> str:
    """
    Translate the provided text from src_lang to tgt_lang using the preconfigured translation pipeline.
    
    Args:
        text (str): Text to translate.
        src_lang (str): Source language code (default 'en').
        tgt_lang (str): Target language code (default 'en').

    Returns:
        str: The translated text.
    
    Raises:
        ValueError: If input text is empty or translation result format is invalid.
        Exception: If an error occurs during translation.
    """
    if not text.strip():
        raise ValueError("Input text for translation is empty.")

    try:
        # Normalize language codes for M2M100 compatibility
        normalized_src = normalize_language_code(src_lang)
        normalized_tgt = normalize_language_code(tgt_lang)
        
        logger.debug(f"Translation: '{src_lang}' -> '{normalized_src}', '{tgt_lang}' -> '{normalized_tgt}'")
        
        # Prepare translator arguments - only include language codes if they're not None (auto-detect)
        translator_kwargs = {}
        if normalized_src is not None:
            translator_kwargs['src_lang'] = normalized_src
        if normalized_tgt is not None:
            translator_kwargs['tgt_lang'] = normalized_tgt
        
        # When calling the translator, pass only the specified language codes
        result = translator(text, **translator_kwargs)
        
        if not result or "translation_text" not in result[0]:
            raise ValueError("Translation pipeline returned an unexpected format.")
        return result[0]["translation_text"]
    except Exception as e:
        logger.exception("Failed to translate text: %s", e)
        raise